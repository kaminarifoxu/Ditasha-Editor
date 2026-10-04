const {test}=require('node:test');const assert=require('node:assert/strict');
const {isTrustedUpdateEvent}=require('./ipc-trust.cjs');
function fixture(url){const mainFrame={url,processId:42,routingId:7};const webContents={mainFrame};return {window:{webContents,isDestroyed:()=>false},event:{sender:webContents,senderFrame:mainFrame}};}
test('Windows packaged IPC accepts Chromium URL normalization and escaped names',()=>{
 const f=fixture('file:///c:/Users/Foxu/AppData/Local/Temp/DITASHA%20Editor/resources/app.asar/ui/index.html');
 assert.equal(isTrustedUpdateEvent(f.event,f.window,'C:\\Users\\Foxu\\AppData\\Local\\Temp\\DITASHA Editor\\resources\\app.asar\\ui\\index.html','win32'),true);
 const alternate={...f.event,senderFrame:{...f.event.senderFrame}};
 assert.equal(isTrustedUpdateEvent(alternate,f.window,'C:\\Users\\Foxu\\AppData\\Local\\Temp\\DITASHA Editor\\resources\\app.asar\\ui\\index.html','win32'),true);
});
test('IPC rejects foreign sender, subframe, remote URL and unexpected local file',()=>{
 const expected='C:\\editor\\resources\\app.asar\\ui\\index.html';
 const f=fixture('file:///C:/editor/resources/app.asar/ui/index.html');
 assert.equal(isTrustedUpdateEvent(f.event,f.window,expected,'win32'),true);
 assert.equal(isTrustedUpdateEvent({...f.event,sender:{}},f.window,expected,'win32'),false);
 assert.equal(isTrustedUpdateEvent({...f.event,senderFrame:{...f.event.senderFrame,routingId:99}},f.window,expected,'win32'),false);
 for(const url of ['https://example.com/index.html','file:///C:/other/index.html','file://remote/editor/index.html','file:///C:/editor/resources/app.asar/ui/index.html?other=1']){const e=fixture(url);assert.equal(isTrustedUpdateEvent(e.event,e.window,expected,'win32'),false);}
});
test('POSIX IPC keeps paths case sensitive',()=>{const f=fixture('file:///opt/DITASHA%20Editor/ui/index.html');assert.equal(isTrustedUpdateEvent(f.event,f.window,'/opt/DITASHA Editor/ui/index.html','linux'),true);assert.equal(isTrustedUpdateEvent(f.event,f.window,'/opt/ditasha editor/ui/index.html','linux'),false);});
