export function mountWeaponNativeExport({layout,getReference,getName,toast}) {
  const panel=document.createElement('details');
  panel.className='wd-native-weapon';
  panel.innerHTML="<summary>Native GTA / FiveM weapon build (M2c)</summary>\n<p class=\"muted\">Requires an existing GTA V Legacy rigged weapon donor with matching YDR and YTD. A plain GLB or sketch is not enough. Blender/Sollumz verifies skeleton, muzzle, magazine and grip bones; AddonWeaponsBuilder packages GTA DLC. FiveM resource output requires complete loose metadata.</p>\n<button type=\"button\" data-wn-deps>Check Blender &amp; AddonWeaponsBuilder</button><p data-wn-dep-status role=\"status\" class=\"muted\">Native tools not checked.</p>\n<button type=\"button\" data-wn-source>Select prepared YDR + YTD folder</button><small data-wn-source-name>No source selected</small>\n<button type=\"button\" data-wn-output>Select output folder</button><small data-wn-output-name>No output selected</small>\n<label>New weapon model name<input data-wn-model value=\"w_pi_ditashaweapon\" maxlength=\"48\" spellcheck=\"false\"></label>\n<label>Weapon price<input data-wn-price type=\"number\" value=\"5000\" min=\"0\" max=\"10000000\" step=\"1\"></label>\n<p class=\"muted\">The source reference comes from Acuan FiveM above. Install the verified AddonWeaponsBuilder using the existing panel if necessary.</p>\n<button type=\"button\" data-wn-build class=\"primary\">Validate &amp; build GTA weapon DLC</button>\n<button type=\"button\" data-wn-cancel disabled>Cancel build</button>\n<pre data-wn-result role=\"status\" aria-live=\"polite\">No weapon build started.</pre>";
  layout.querySelector('.wd-export').append(panel);
  const find=key=>panel.querySelector('[data-wn-'+key+']');
  const api=()=>window.ditashaWeaponCreator;
  const status=s=>{find('result').textContent=s;};
  let source=null,output=null,activeJob=null,pollTimer=null;
  const busy=value=>{
    for(const key of ['source','output','model','price','build'])find(key).disabled=value;
    find('cancel').disabled=!value;
  };
  find('deps').onclick=async()=>{
    find('dep-status').textContent='Checking managed tools…';
    try {
      if(!api())throw Error('Weapon export requires DITASHA desktop Windows.');
      const result=await api().deps();
      find('dep-status').textContent=result.message;
    }catch(error){find('dep-status').textContent=error.message;}
  };
  for(const kind of ['source','output']){
    find(kind).onclick=async()=>{
      try{
        if(!api())throw Error('Weapon export requires desktop Windows.');
        const chosen=await api().pick(kind);
        if(!chosen)return;
        const prior=kind==='source'?source:output;
        if(kind==='source')source=chosen;else output=chosen;
        find(kind+'-name').textContent=chosen.name;
        if(prior)await api().revoke(prior.token).catch(()=>{});
      }catch(error){status(error.message);}
    };
  }
  find('build').onclick=async()=>{
    if(activeJob)return;
    if(!source||!output)return status('Select the prepared native source and output folders.');
    const reference=getReference();
    if(!reference)return status('Select a supported GTA reference first.');
    try{
      if(!api())throw Error('Weapon export requires DITASHA desktop Windows.');
      const response=await api().start({
        schemaVersion:1,edition:'legacy',sourceToken:source.token,outputToken:output.token,
        reference:reference[1],name:getName().trim(),modelName:find('model').value.trim(),
        price:Number(find('price').value),
      });
      activeJob=response.jobId;
      busy(true);
      status('Blender/Sollumz native skeleton and attachment verification started…');
      const poll=async()=>{
        if(!activeJob)return;
        try{
          const job=await api().job(activeJob);
          if(!job)throw Error('Weapon build status unavailable');
          if(job.state==='queued'||job.state==='running')return;
          clearInterval(pollTimer);pollTimer=null;activeJob=null;busy(false);
          if(job.state==='succeeded'){
            const result=job.result;
            status('GTA DLC validated: '+result.output+
              '\nNative skeleton round-trip passed.'+
              '\nFiveM resource: '+(result.fiveMReady?'generated, not game-tested':'not generated')+
              '\n'+(result.notes||'')+
              '\nUse CodeWalker and a test FiveM server to verify.');
          }else status('Weapon build '+job.state+': '+(job.error||'No details'));
        }catch(error){
          clearInterval(pollTimer);pollTimer=null;activeJob=null;busy(false);
          status(error.message);
        }
      };
      pollTimer=setInterval(()=>{void poll();},900);
      await poll();
    }catch(error){activeJob=null;busy(false);status(error.message);toast?.(error.message);}
  };
  find('cancel').onclick=async()=>{
    if(!activeJob)return;
    try{await api().cancel(activeJob);status('Cancelling weapon build…');}
    catch(error){status(error.message);}
  };
  return panel;
}