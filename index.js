const dhive = require('@hiveio/dhive')
const _ = require('lodash')
const Cloudflare = require('cloudflare')
const request = require("request");
const storage = require('node-persist');

// the cloudflare credentials
const CF_ZONE = process.env['CF_ZONE'] || die('CF_ZONE missing')
const CF_API_TOKEN = process.env['CF_API_TOKEN']
const CF_ACCOUNT_API_TOKEN = process.env['CF_ACCOUNT_API_TOKEN']
const CF_EMAIL = process.env['CF_EMAIL']
const CF_KEY = process.env['CF_KEY']

// setup the cloudflare
let cf
if (CF_API_TOKEN) {
  cf = new Cloudflare({ apiToken: CF_API_TOKEN })
} else if (CF_ACCOUNT_API_TOKEN) {
  cf = new Cloudflare({ apiToken: CF_ACCOUNT_API_TOKEN })
} else if (CF_EMAIL && CF_KEY) {
  cf = new Cloudflare({ apiEmail: CF_EMAIL, apiKey: CF_KEY })
} else {
  die('CF_API_TOKEN, CF_ACCOUNT_API_TOKEN, or CF_EMAIL and CF_KEY missing')
}

// lookup zones if do not know
//cf.zones.browse().then(console.log)

// imagehoster domain
const domain = process.env['DOMAIN'] || 'https://images.ecency.com'

// setup the dhive client
const client = new dhive.Client(['https://api.hive.blog', 'https://rpc.ecency.com', 'https://api.deathwing.me'])

// queue in memory

let users = [];
const PURGE_BATCH_SIZE = 30;

// get latest block and its operations
async function getOperations() {
  await storage.init( /* options ... */ );
  users = await storage.getItem('users') || [];
  try {
    for await (const block of client.blockchain.getBlocks({mode: dhive.BlockchainMode.Latest})) {
      //console.log('new block, id:', block.block_id)
      if (_.has(block, 'transactions[0].operations')) {
        for (let tx of block.transactions) {
          for (let op of tx.operations) {
            if (op[0] === 'account_update2') {
              const user = op[1].account
              users.push(user);
              users = _.uniq(users);
              await storage.setItem('users', users);
              try {
                await purge();
              } catch (e) {
                console.error(new Date().toISOString(), 'purge failed', e);
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.log('caught', e)
    getOperations()
  }
}

getOperations()

function die(msg) { 
  process.stderr.write(msg+'\n')
  process.exit(1)
}

async function ihAlive() {
  return new Promise((resolve) => {
    request(domain, (error, response) => {
      if (!error && response && response.statusCode < 500) {
        console.log(domain + ' is up!!');
        resolve(true);
      } else {
        if (error) {
          console.log('domain check err: ' + error);
        } else {
          console.log(domain + ' is down!!');
        }
        resolve(false);
      }
    });
  });
}

async function purge() {
  let targetUrls = [];
  if (users.length > 0) {
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      targetUrls = [...targetUrls,...[
          `${domain}/u/${u}/avatar`,
          `${domain}/u/${u}/avatar/small`,
          `${domain}/u/${u}/avatar/medium`,
          `${domain}/u/${u}/avatar/large`,
          `${domain}/webp/u/${u}/avatar`,
          `${domain}/webp/u/${u}/avatar/small`,
          `${domain}/webp/u/${u}/avatar/medium`,
          `${domain}/webp/u/${u}/avatar/large`,
          `${domain}/webp/u/${u}/cover`,
          `${domain}/u/${u}/cover`,
        ]      
      ]
    }
    const isIHAlive = await ihAlive();
    if (isIHAlive) {
      console.log('purging', targetUrls.length, 'files');
      const batches = _.chunk(targetUrls, PURGE_BATCH_SIZE);
      for (const files of batches) {
        try {
          const data = await cf.cache.purge({ zone_id: CF_ZONE, files });
          console.log(`${new Date().toISOString()} result:`, data);
        } catch (error) {
          console.error(new Date().toISOString(), error);
        }
      }
      users = [];
      await storage.setItem('users', users);
      targetUrls = [];
    }
  }
}
