
const { session } = require('electron');
const { throttle } = require('lodash');


function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}


function verifySessionStorage() {
  const ses = session.fromPartition('persist:browser-session');
  
  // Check cookies
  ses.cookies.get({})
    .then((cookies) => {
      console.log('Stored cookies:', cookies.length);
      cookies.forEach((cookie, i) => console.log(`${i} ::::: ${cookie.name}: ${cookie.value}`));
    })
    .catch(error => console.error('Error retrieving cookies:', error));

  // Check storage usage
  // ses.getStorageUsage()
  //   .then(usage => {
  //     console.log('Storage usage:', usage);
  //   })
  //   .catch(error => console.error('Error retrieving storage usage:', error));

  // Check cache size
  ses.getCacheSize()
    .then(size => {
      console.log('Cache size:', size, 'bytes');
    })
    .catch(error => console.error('Error retrieving cache size:', error));
}


async function base64ToArrayBuffer(base64) {
  base64 = base64.replace(/^data:image\/png;base64,/, "");
  base64 = base64.replace(/^data:image\/jpeg;base64,/, "");
  base64 = base64.replace(/^data:image\/webp;base64,/, "");
  // console.log({base64})
  let imageBuffer = Buffer.from(base64, 'base64');

  return imageBuffer;
    
}


let lastNavigationTime = 0;
const THROTTLE_DELAY = 2000;

const throttledNavigation = throttle((view, url) => {
  const currentTime = Date.now();
  if (currentTime - lastNavigationTime >= THROTTLE_DELAY) {
    console.log(`Navigating to: ${url}`);
    view.loadURL(url);
    lastNavigationTime = currentTime;
  } else {
    console.log(`Navigation to ${url} throttled`);
  }
}, THROTTLE_DELAY, { leading: true, trailing: false });

module.exports = {
  debounce,
  verifySessionStorage,
  base64ToArrayBuffer,
  throttledNavigation
};