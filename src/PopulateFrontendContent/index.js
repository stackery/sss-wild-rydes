const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const cfnCR = require('cfn-custom-resource');
const recursiveReaddir = require('recursive-readdir');
const mime = require('mime-types');

const s3 = new AWS.S3();

exports.handler = async (event, context) => {
  // Log the event argument for debugging and for use in local development.
  console.log(JSON.stringify(event, undefined, 2));

  try {
    await uploadStaticContent();
    await uploadConfig();

    await cfnCR.sendSuccess('PopulateFrontendContent', {}, event);
  } catch (err) {
    await cfnCR.sendFailure(err.message, event);
  }

  return {};
};

async function uploadStaticContent() {
  const files = await recursiveReaddir('static', [ 'config.js.template' ]);

  const promises = files.map(file => s3.putObject({
    Bucket: process.env.BUCKET_NAME,
    Key: path.relative('static', file),
    Body: fs.createReadStream(file),
    ContentType: mime.lookup(file) || 'application/octet-stream',
    ACL: 'public-read'
  }).promise());

  await Promise.all(promises);
}

async function uploadConfig() {
  const config = {
    api: {
      invokeUrl: process.env.API_URL + '/ride'
    },
    cognito: {
      userPoolId: process.env.USER_POOL_ID,
      userPoolClientId: process.env.USER_POOL_CLIENT_ID,
      region: process.env.AWS_REGION,
      disabled: !process.env.USER_POOL_CLIENT_ID
    }
  };

  const configString = `window._config = ${JSON.stringify(config, null, 2)}`;

  await s3.putObject({
    Bucket: process.env.BUCKET_NAME,
    Key: 'js/config.js',
    Body: configString,
    ContentType: mime.lookup('config.js'),
    ACL: 'public-read'
  }).promise();
}
