
const { session } = require('electron');
const sharp = require('sharp');

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

  let image = await sharp(imageBuffer)
    .raw()
    .toBuffer({resolveWithObject: true});

    console.log({image})
    // convert to a tensor

    
    
    let output = convertImageData(image);
    console.log({output})
    return output;
    
}

function convertImageData(inputData) {
  const { data, info } = inputData;
  const { width, height } = info;

  // Create a Uint8Array from the buffer
  const uint8Array = new Uint8Array(data);

  // Create a new Uint32Array with the correct size (one 32-bit integer per pixel)
  const uint32Array = new Uint32Array(width * height);

  // Pack RGB values into Uint32Array
  for (let i = 0, j = 0; i < uint8Array.length; i += 3, j++) {
    const r = uint8Array[i];
    const g = uint8Array[i + 1];
    const b = uint8Array[i + 2];
    // Combine RGB into a single 32-bit integer
    // Note: TensorFlow.js expects RGBA format in little-endian order
    uint32Array[j] = (255 << 24) | (b << 16) | (g << 8) | r;
  }

  // Return the object in the exact format expected by tf.browser.fromPixels()
  return {
    data: uint32Array,
    width: width,
    height: height
  };
}

module.exports = {
  debounce,
  verifySessionStorage,
  base64ToArrayBuffer
};