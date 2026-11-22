// Retries only this read operation, never a mutation with an ambiguous outcome.
export async function checkGateway(url,token,{fetcher=fetch,pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=4}={}){
  let reason='yanıt alınamadı';
  for(let attempt=0;attempt<attempts;attempt++){
    try{
      const response=await fetcher(new URL('/action',url),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({action:'list_projects',args:{}}),redirect:'error',signal:AbortSignal.timeout(20000)});
      let data;try{data=await response.json();}catch{reason=`HTTP ${response.status}: JSON yerine farklı içerik geldi`;}
      if(response.ok&&data&&Array.isArray(data.projects))return data;
      if(response.status===401||response.status===403)throw new Error(`Gateway yetkilendirmesi reddedildi (HTTP ${response.status}). Yerel ve Cloudflare anahtarlarını kontrol et.`);
      if(data)reason=`HTTP ${response.status}: beklenen proje yanıtı alınamadı`;
    }catch(error){if(error instanceof Error&&error.message.startsWith('Gateway yetkilendirmesi'))throw error;reason='Gateway bağlantısı tamamlanamadı';}
    if(attempt<attempts-1)await pause(1000*(attempt+1));
  }
  throw new Error(`Worker yayımlandı; bağlantı kontrolü başarısız: ${reason}. Anahtar yerelde korunuyor. docs/kurulum.md içindeki bağlantı doğrulama adımlarını izle.`);
}
