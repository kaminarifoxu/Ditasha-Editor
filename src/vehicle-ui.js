export function mountVehicleWorkspace({ nav, viewers, onVehicleBuild }) {
  const button = document.createElement('button');
  button.dataset.page = 'vehicles';
  button.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 7 2-4h10l2 4 2 3v8H3v-8l2-3Zm0 0h14M3 13h18M6 10h2m8 0h2M5 18v3m14-3v3"/></svg>Vehicle workshop';
  nav.querySelector('[data-page="archives"]').after(button);
  const root = document.createElement('section');
  root.className = 'vehicle-workspace';
  root.hidden = true;
  root.innerHTML = `<div class="vehicle-workspace-head"><div><span class="eyebrow">GTA V · OFFLINE</span><h2>Vehicle workshop</h2></div><div class="viewer-button-row"><button id="vehicleOpen" class="primary">Open YFT / YTD</button><button id="vehicleDebadge">Debadge native</button><button id="vehicleStrobo">Strobo donor</button><button id="vehicleParts">Inject donor parts</button></div></div><div class="vehicle-viewer-host"></div>`;
  nav.after(root);
  root.querySelector('#vehicleOpen').onclick = () => document.getElementById('mvInput').click();
  root.querySelector('#vehicleDebadge').onclick = () => onVehicleBuild?.('debadge');
  root.querySelector('#vehicleStrobo').onclick = () => onVehicleBuild?.('strobo');
  root.querySelector('#vehicleParts').onclick = () => onVehicleBuild?.('parts');
  viewers.vehicleControls.open = true;
  return { root, host: root.querySelector('.vehicle-viewer-host') };
}
