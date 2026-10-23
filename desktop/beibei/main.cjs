const {app,BrowserWindow,Menu,protocol,session,dialog,shell}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises');
const {resolveResource}=require('./protocol.cjs');
const origin='beibei://app';let mainWindow;
app.setName('背背');app.setAppUserModelId('cn.beibei.desktop');
protocol.registerSchemesAsPrivileged([{scheme:'beibei',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
if(!app.requestSingleInstanceLock())app.quit();
else {
  app.on('second-instance',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.focus();}});
  app.whenReady().then(async()=>{
    protocol.handle('beibei',async request=>{
      try{const {file,type}=resolveResource(request.url,path.join(__dirname,'web'));return new Response(await fs.readFile(file),{headers:{'Content-Type':type,'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'self'"}});}
      catch{return new Response('Not found',{status:404});}
    });
    session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    session.defaultSession.setPermissionCheckHandler(()=>false);
    session.defaultSession.on('will-download',(_event,item)=>{item.setSaveDialogOptions({title:'保存文件',defaultPath:path.join(app.getPath('downloads'),path.basename(item.getFilename()))});});
    mainWindow=new BrowserWindow({width:1280,height:860,minWidth:800,minHeight:600,title:'背背',backgroundColor:'#f7f6f2',icon:path.join(__dirname,'assets/icon.ico'),show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,spellcheck:false}});
    mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    mainWindow.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(origin+'/'))event.preventDefault();});
    mainWindow.once('ready-to-show',()=>mainWindow.show());
    mainWindow.webContents.on('did-fail-load',(_event,code,message)=>{if(code!==-3)dialog.showErrorBox('背背无法打开',message);});
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label:'文件',submenu:[{label:'打开数据文件夹',click:()=>shell.openPath(app.getPath('userData'))},{type:'separator'},{role:'quit',label:'退出'}]},
      {label:'编辑',submenu:[{role:'undo',label:'撤销'},{role:'redo',label:'重做'},{type:'separator'},{role:'cut',label:'剪切'},{role:'copy',label:'复制'},{role:'paste',label:'粘贴'},{role:'selectAll',label:'全选'}]},
      {label:'视图',submenu:[{role:'resetZoom',label:'实际大小'},{role:'zoomIn',label:'放大'},{role:'zoomOut',label:'缩小'},{type:'separator'},{role:'togglefullscreen',label:'全屏'}]},
      {label:'帮助',submenu:[{label:'关于背背',click:()=>dialog.showMessageBox(mainWindow,{type:'info',title:'背背',message:`背背 ${app.getVersion()}`,detail:'理解 + 重复\n支持离线使用。卡片和图片保存在这台电脑。\n网页版数据与桌面版独立，可通过卡片导入添加内容。'})}]}
    ]));
    await mainWindow.loadURL(origin+'/index.html');
  }).catch(error=>{dialog.showErrorBox('背背启动失败',error.message);app.quit();});
  app.on('window-all-closed',()=>app.quit());
}
