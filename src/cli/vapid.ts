/*
 * CLI to generate VAPID keys for web push. To run use
 * `npm run vapid` from the root. This script will generate new
 * VAPID keys, merge them into data/settings.json and print the
 * public key to the console. If keys already exist they will be
 * overwritten.
 */

import webPush from 'web-push';
import { getSettings, saveSettings } from '../store.js';

async function generate() {
  const keys = webPush.generateVAPIDKeys();
  const settings = await getSettings();
  settings.vapid.publicKey = keys.publicKey;
  settings.vapid.privateKey = keys.privateKey;
  await saveSettings(settings);
  console.log('\nGenerated new VAPID keys. Public key:\n');
  console.log(keys.publicKey);
  console.log('\nUpdated data/settings.json with new keys.');
}
generate().catch((err) => {
  console.error(err);
  process.exit(1);
});