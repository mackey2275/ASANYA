const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP = process.env.ASANYA_TEST_APP || '/asanya_task_manager_v200.html';
const TARGET_PRODUCT_VERSION = process.env.ASANYA_TEST_PRODUCT_VERSION || '';
const TARGET_SCHEMA_VERSION = process.env.ASANYA_TEST_SCHEMA_VERSION || '';
const APP_FS_PATH = path.resolve(__dirname, '..', '..', APP.replace(/^\//, ''));
const APP_FILE_URL = pathToFileURL(APP_FS_PATH).href;

module.exports = { APP, APP_FILE_URL, APP_FS_PATH, TARGET_PRODUCT_VERSION, TARGET_SCHEMA_VERSION };
