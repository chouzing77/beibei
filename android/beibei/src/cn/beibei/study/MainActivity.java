package cn.beibei.study;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.*;
import android.util.Base64;
import android.view.View;
import org.json.JSONObject;
import java.io.*;
import java.util.*;

/** Offline packaged web app. Only trusted bundled assets can execute the file bridge. */
public final class MainActivity extends Activity {
    private static final String ORIGIN="https://appassets.androidplatform.net";
    private static final int PICK=100,SAVE=101;
    private WebView web;
    private ValueCallback<Uri[]> chooser;
    private File saveTemp;
    private FileOutputStream saveStream;
    private String saveId,saveName,saveMime;
    private long saveBytes;
    private final java.util.concurrent.ExecutorService io=java.util.concurrent.Executors.newSingleThreadExecutor();

    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);web=new WebView(this);setContentView(web);
        web.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);settings.setMediaPlaybackRequiresUserGesture(true);
        web.addJavascriptInterface(new FileBridge(),"BeibeiAndroid");
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return !trusted(r.getUrl());}
            @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){
                Uri u=r.getUrl();if(!trusted(u))return denied();
                String path=u.getPath().substring(1);if(path.isEmpty())path="index.html";
                if(path.contains("..")||path.contains("\\"))return denied();
                try{return new WebResourceResponse(mime(path),"UTF-8",200,"OK",Collections.singletonMap("Cache-Control","no-cache"),getAssets().open("web/"+path));}
                catch(IOException e){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
            }
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> cb,FileChooserParams params){
                if(chooser!=null)chooser.onReceiveValue(null);chooser=cb;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("*/*");intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
                String[] accept=params.getAcceptTypes();if(accept.length>0&&accept[0].startsWith("image/"))intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/png","image/jpeg","image/webp","image/gif"});
                try{startActivityForResult(intent,PICK);}catch(Exception e){chooser.onReceiveValue(null);chooser=null;}return true;
            }
            @Override public boolean onJsConfirm(WebView v,String url,String msg,JsResult result){new AlertDialog.Builder(MainActivity.this).setMessage(msg).setPositiveButton("确定",(d,w)->result.confirm()).setNegativeButton("取消",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
            @Override public boolean onJsAlert(WebView v,String url,String msg,JsResult result){new AlertDialog.Builder(MainActivity.this).setMessage(msg).setPositiveButton("确定",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
        });
        web.loadUrl(ORIGIN+"/index.html");
    }
    private boolean trusted(Uri uri){return "https".equals(uri.getScheme())&&"appassets.androidplatform.net".equals(uri.getHost())&&(uri.getPort()==-1||uri.getPort()==443);}
    private WebResourceResponse denied(){return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
    private static String mime(String path){String ext=path.substring(path.lastIndexOf('.')+1).toLowerCase(Locale.ROOT);switch(ext){case "html":return "text/html";case "js":return "application/javascript";case "css":return "text/css";case "json":return "application/json";case "svg":return "image/svg+xml";case "png":return "image/png";case "txt":case "tsv":case "csv":return "text/plain";case "xlsx":return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";default:return "application/octet-stream";}}
    private void result(String id,boolean ok,String message){runOnUiThread(()->web.evaluateJavascript("window.beibeiFileResult&&window.beibeiFileResult("+JSONObject.quote(id)+","+ok+","+JSONObject.quote(message)+")",null));}
    private synchronized void clearSave(){try{if(saveStream!=null)saveStream.close();}catch(IOException ignored){}saveStream=null;if(saveTemp!=null)saveTemp.delete();saveTemp=null;saveId=null;saveBytes=0;}
    public final class FileBridge{
        @JavascriptInterface public synchronized void beginSave(String id,String name,String type){
            if(saveId!=null)throw new IllegalStateException("已有文件正在保存");
            if(id==null||!id.matches("[a-zA-Z0-9-]{1,80}"))throw new IllegalArgumentException("Invalid id");
            try{saveTemp=File.createTempFile("beibei-export-",".tmp",getCacheDir());saveStream=new FileOutputStream(saveTemp);saveId=id;saveName=name.replaceAll("[\\\\/:*?\"<>|]","_");if(saveName.length()>120)saveName=saveName.substring(0,120);saveMime=type;saveBytes=0;}catch(IOException e){clearSave();throw new IllegalStateException("无法准备导出文件");}
        }
        @JavascriptInterface public synchronized void appendSave(String id,String encoded){
            if(!Objects.equals(id,saveId)||saveStream==null)throw new IllegalStateException("Invalid save");
            byte[] bytes=Base64.decode(encoded,Base64.DEFAULT);saveBytes+=bytes.length;
            if(saveBytes>100L*1024*1024){clearSave();throw new IllegalArgumentException("文件超过 100 MB");}
            try{saveStream.write(bytes);}catch(IOException e){clearSave();throw new IllegalStateException("存储空间不足");}
        }
        @JavascriptInterface public synchronized void finishSave(String id){
            if(!Objects.equals(id,saveId)||saveStream==null)throw new IllegalStateException("Invalid save");
            try{saveStream.close();saveStream=null;}catch(IOException e){clearSave();throw new IllegalStateException("文件保存失败");}
            runOnUiThread(()->{Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType(saveMime);intent.putExtra(Intent.EXTRA_TITLE,saveName);try{startActivityForResult(intent,SAVE);}catch(Exception e){result(id,false,"没有可用的文件保存应用");clearSave();}});
        }
    }
    @Override protected void onActivityResult(int request,int status,Intent intent){super.onActivityResult(request,status,intent);
        if(request==PICK&&chooser!=null){List<Uri> uris=new ArrayList<>();if(status==RESULT_OK&&intent!=null){if(intent.getClipData()!=null)for(int i=0;i<intent.getClipData().getItemCount();i++)uris.add(intent.getClipData().getItemAt(i).getUri());else if(intent.getData()!=null)uris.add(intent.getData());}chooser.onReceiveValue(uris.isEmpty()?null:uris.toArray(new Uri[0]));chooser=null;}
        if(request==SAVE&&saveId!=null){final String id=saveId;final File file=saveTemp;
            if(status!=RESULT_OK||intent==null||intent.getData()==null){result(id,false,"保存已取消");clearSave();return;}
            final Uri uri=intent.getData();io.execute(()->{try(InputStream in=new FileInputStream(file);OutputStream out=getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new IOException();byte[] buffer=new byte[32768];int n;while((n=in.read(buffer))!=-1)out.write(buffer,0,n);out.flush();result(id,true,"");}catch(Exception e){result(id,false,"文件保存失败，请检查可用空间");}finally{clearSave();}});
        }
    }
    @Override public void onBackPressed(){web.evaluateJavascript("(()=>{const d=[...document.querySelectorAll('dialog[open]')].pop();if(d){d.dispatchEvent(new Event('cancel',{cancelable:true}))&&d.close();return true;}if(typeof activeView!=='undefined'&&(activeView!=='folders'||activeFolderId)){activeFolderId=null;setView('folders');return true;}return false;})()",handled->{if(!"true".equals(handled))super.onBackPressed();});}
    @Override protected void onDestroy(){if(chooser!=null)chooser.onReceiveValue(null);clearSave();web.removeJavascriptInterface("BeibeiAndroid");web.destroy();io.shutdown();super.onDestroy();}
}
