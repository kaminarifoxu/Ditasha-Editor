const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('ganoUpdates',{
 getState:()=>ipcRenderer.invoke('gano:update-state'),
 check:()=>ipcRenderer.invoke('gano:update-check'),
 download:()=>ipcRenderer.invoke('gano:update-download'),
 install:()=>ipcRenderer.invoke('gano:update-install'),
 updateNow:()=>ipcRenderer.invoke('gano:update-now'),
 setAutoDownload:enabled=>ipcRenderer.invoke('gano:update-auto',enabled),
 subscribe:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('gano:update-state',listener);return()=>ipcRenderer.removeListener('gano:update-state',listener);}
});

contextBridge.exposeInMainWorld('ditashaDesktop',{
 ready:()=>ipcRenderer.send('ditasha:ready'),
 openDonation:()=>ipcRenderer.invoke('ditasha:open-donation'),
 saveExport:payload=>ipcRenderer.invoke('ditasha:save-export',payload)
});
