const dhive = require('@hiveio/dhive')
const _ = require('lodash')
const cloudflare = require('cloudflare')
const request = require("request");

// the cloudflare api key
const CF_KEY = process.env['CF_KEY'] || die('CF_KEY missing')
const CF_ZONE = process.env['CF_ZONE'] || die('CF_ZONE missing')

// setup the cloudflare
const cf = new cloudflare({token: CF_KEY})

// lookup zones if do not know
//cf.zones.browse().then(console.log)

// imagehoster domain
const domain = process.env['DOMAIN'] || 'https://images.ecency.com'

// setup the dhive client
const client = new dhive.Client(['https://api.hive.blog', 'https://rpc.ecency.com', 'https://api.deathwing.me'])

// get latest block and its operations
async function getOperations() {
  try {
    for await (const block of client.blockchain.getBlocks({mode: dhive.BlockchainMode.Latest})) {
      //console.log('new block, id:', block.block_id)
      if (_.has(block, 'transactions[0].operations')) {
        for (let tx of block.transactions) {
          for (let op of tx.operations) {
            if (op[0] === 'account_update2') {
              const user = op[1].account
              const targetUrls = [
                `${domain}/u/${user}/avatar`,
                `${domain}/u/${user}/avatar/small`,
                `${domain}/u/${user}/avatar/medium`,
                `${domain}/u/${user}/avatar/large`,
                `${domain}/webp/u/${user}/avatar`,
                `${domain}/webp/u/${user}/avatar/small`,
                `${domain}/webp/u/${user}/avatar/medium`,
                `${domain}/webp/u/${user}/avatar/large`,
              ]
              const isIHAlive = await ihAlive();
              if (isIHAlive) {
                console.log('purging', targetUrls);
                cf.zones.purgeCache(CF_ZONE, { "files": targetUrls }).then(function (data) {
                  console.log(`${new Date().toISOString()} result:`, data)
                }, function (error) {
                  console.error(new Date().toISOString(), error)
                });  
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
  return request(domain , function (error, response, body) {
    if (response.statusCode == 200 || response.statusCode == 201 || response.statusCode == 202){
      console.log(domain + ' is up!!');
      return true;
    }
    if (error){
      console.log('domain check err: '+ error);
      return false;
    }
    console.log(domain + ' is down!!');
    return false
  });
}
