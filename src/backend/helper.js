const { session } = require('electron');

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


module.exports = {
  debounce,
  verifySessionStorage
};