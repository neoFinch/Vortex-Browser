const tf = require('@tensorflow/tfjs-node');
const mobilenet = require('@tensorflow-models/mobilenet');

async function loadModel() {
  let model = await mobilenet.load();
  return model;
  console.log('MobileNet model loaded');
}


module.exports = {
  loadModel
};