require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require('path');
const https = require('https');
const fs = require('fs');

const app = express();
const srvFolder = 'srv_data/';

var corsOptions = {
  origin: "http://localhost:8081"
};

app.use(cors(corsOptions));

// simple route
app.get("/collect", (req, res) => {
  collectData();
  res.end('data has been collected');
});

function saveEtsyListingsData(res) {
  var savedListings = [];
  const options = {
    hostname: 'openapi.etsy.com',
    path: `/v3/application/shops/${process.env.ETSY_SHOP_ID}/listings/active`,
    method: 'GET',
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": `${process.env.ETSY_API_KEY}`
    }
  }
  https.get(options, (resp) => {
    let data = '';
    // A chunk of data has been received.
    resp.on('data', (chunk) => {
      data += chunk;
    });

    // The whole response has been received. Print out the result.
    resp.on('end', () => {
      var json = JSON.parse(data);
      if (json.count > 0) {
        var results = json.results;
        // save listings data in the separated files
        var cnt = results.length;
        results.forEach(function (listing) {

          if (listing['listing_type'] != "physical") {
            cnt--;
            return;
          }

          var filePath = srvFolder + 'listings/' + listing['listing_id'] + '_listing.json';

          fs.stat(filePath, (err, stat) => {
            if (err == null) {
              // file exists
              cnt--;
            } else if (err.code === 'ENOENT') {
              console.log('to write filePath: ' + filePath);
              fs.writeFile(filePath, JSON.stringify(listing), err => {
                if (err) {
                  console.error(err);
                }
                savedListings.push(listing);
                cnt--;
                console.log('savedListings length after push: ' + savedListings.length)
                if (cnt === 0) {
                  console.log('cnt: ' + cnt);
                  res(savedListings);
                }

              });
            }
          })
        })

      }
    })

  }).on("error", (err) => {
    console.log("Error: " + err.message);
  })

}

// calls by Interval
// save images info & pics
function saveEtsyImagesData(listings) {
  if (listings.length == 0)
    return;

  listings.forEach(function (listing) {
    var lid = listing['listing_id'];

    const options = {
      hostname: 'openapi.etsy.com',
      path: `https://openapi.etsy.com/v3/application/listings/${lid}/images`,
      method: 'GET',
      headers: {

        Accept: "application/json",
        "Content-Type": "application/json",
        "x-api-key": `${process.env.ETSY_API_KEY}`
      }
    }

    https.get(options, (resp) => {
      let data = '';
      // A chunk of data has been received.
      resp.on('data', (chunk) => {
        data += chunk;

      });

      // The whole response has been received. Print out the result.
      resp.on('end', () => {
        // TODO check if already exists
        fs.writeFile(srvFolder + 'images_info/' + lid + '_images.json', data, err => {
          if (err) {
            console.error(err);
          }
        });
        const json = JSON.parse(data);
        const firstPicUrl = json.results[0].url_570xN;
        const filePath = srvFolder + 'images/' + lid + '.jpg';
        const file = fs.createWriteStream(filePath);

        https.get(firstPicUrl, function (response) {
          response.pipe(file);
          // after download completed close filestream
          file.on("finish", () => {
            file.close();
          });
        });

        var fileCnt = 0;
        json.results.forEach(
          function (result) {
            fileCnt++;
            let picUrl = result.url_570xN;
            let picFilePath = srvFolder + 'images/' + lid + '_' + fileCnt + '.jpg';
            let picFile = fs.createWriteStream(picFilePath);

            https.get(picUrl, function (response) {
              response.pipe(picFile);
              // after download completed close filestream
              picFile.on("finish", () => {
                picFile.close();
              });
            });
          }

        );


      })
    }).on("error", (err) => {
      console.log("Error: " + err.message);
    })
  });
}

function collectData() {
  console.log('Get data at ' + new Date());
  new Promise((res, rej) => {
    saveEtsyListingsData(res)
  }).then((r) => { saveEtsyImagesData(r) })
}

setInterval(collectData, process.env.REQUEST_REPEAT_INTERVAL);

// set port, listen for requests
const PORT = process.env.NODE_DOCKER_PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});


