const path=require('node:path');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8','.tsv':'text/tab-separated-values; charset=utf-8','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.png':'image/png','.ico':'image/x-icon'};
function resolveResource(raw,root){
  const url=new URL(raw);if(url.protocol!=='beibei:'||url.hostname!=='app'||url.port||url.username||url.password)throw Error('Invalid origin');
  const decoded=decodeURIComponent(url.pathname);if(decoded.includes('\\')||decoded.includes('\0'))throw Error('Invalid path');
  const file=path.resolve(root,'.'+(decoded==='/'?'/index.html':decoded));const relative=path.relative(root,file);
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('Outside app');
  return {file,type:types[path.extname(file).toLowerCase()]||'application/octet-stream'};
}
module.exports={resolveResource};
