const cleanHeader = (value, maxLength = 100) => {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
};

const readTrustedLocation = (headers = {}, trustedProxy = process.env.TRUSTED_GEO_PROXY) => {
  const proxy = String(trustedProxy || '').trim().toLowerCase();
  let city = '';
  let region = '';
  let country = '';

  if (proxy === 'cloudflare') {
    city = cleanHeader(headers['cf-ipcity']);
    region = cleanHeader(headers['cf-region']);
    country = cleanHeader(headers['cf-ipcountry'], 3);
  } else if (proxy === 'vercel') {
    city = cleanHeader(headers['x-vercel-ip-city']);
    region = cleanHeader(headers['x-vercel-ip-country-region']);
    country = cleanHeader(headers['x-vercel-ip-country'], 3);
  } else {
    return '';
  }

  return [city, region, country].filter(Boolean).join(', ');
};

const describeUserAgent = (userAgent = '') => {
  const ua = String(userAgent).toLowerCase();
  let deviceType = 'Ordinateur';
  if (/ipad|tablet|kindle|silk/.test(ua) || (/android/.test(ua) && !/mobile/.test(ua))) {
    deviceType = 'Tablette';
  } else if (/mobile|android|iphone|ipod/.test(ua)) {
    deviceType = 'Mobile';
  }

  let operatingSystem = 'Système inconnu';
  if (/windows/.test(ua)) operatingSystem = 'Windows';
  else if (/iphone|ipad|ipod/.test(ua)) operatingSystem = 'iOS';
  else if (/android/.test(ua)) operatingSystem = 'Android';
  else if (/mac os|macintosh/.test(ua)) operatingSystem = 'macOS';
  else if (/linux/.test(ua)) operatingSystem = 'Linux';

  let browser = 'Navigateur inconnu';
  if (/edg\/|edgios\//.test(ua)) browser = 'Microsoft Edge';
  else if (/opr\/|opera/.test(ua)) browser = 'Opera';
  else if (/samsungbrowser\//.test(ua)) browser = 'Samsung Internet';
  else if (/fxios\//.test(ua)) browser = 'Firefox';
  else if (/crios\//.test(ua)) browser = 'Chrome';
  else if (/firefox\//.test(ua)) browser = 'Firefox';
  else if (/chrome\//.test(ua) && !/chromium/.test(ua)) browser = 'Chrome';
  else if (/safari\//.test(ua) && !/chrome\//.test(ua)) browser = 'Safari';

  return { deviceType, operatingSystem, browser };
};

module.exports = { describeUserAgent, readTrustedLocation };
