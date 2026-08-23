const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP = process.env.ASANYA_TEST_APP || '/asanya_task_manager_v200.html';
const APP_FS_PATH = path.resolve(__dirname, '..', '..', APP.replace(/^\//, ''));
const APP_FILE_URL = pathToFileURL(APP_FS_PATH).href;

module.exports = { APP, APP_FILE_URL, APP_FS_PATH };
