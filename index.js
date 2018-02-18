var express = require('express');
var app = express();
var client = require('gdata-js')('XXX', 'YYY', 'http://localhost:3000/');

app.get('/', function (req, res) {
    var token = '';
    var scope = 'https://www.google.com/m8/feeds/'; //contacts
    client.getAccessToken({
        scope: scope,
        access_type: 'offline',
        approval_prompt: 'force'
    }, req, res, function (err, _token) {
        if (err) {
            console.error('oh noes!', err);
            res.writeHead(500);
            res.end('error: ' + JSON.stringify(err));
        } else {
            token = _token;
            console.log('got token:', token);
            res.redirect('/getStuff');
        }
    });
    //client.setToken({ access_token: accessToken, refresh_token: refreshToken });
    /*client.getFeed('https://www.google.com/m8/feeds/contacts/default/full', function (err, result) {

    });*/
});

app.get('/getStuff', function (req, res) {
    client.getFeed('https://www.google.com/m8/feeds/contacts/default/full', { 'max-results': 10},
        function (err, feed) {
            res.writeHead(200);
            for (var i in feed.feed.entry) {
                if(feed.feed.entry[i].gd$phoneNumber!=undefined){
                    var phoneNumber = ''+JSON.stringify(feed.feed.entry[i].gd$phoneNumber[0].$t).replace(/ /g,'');
                    console.log(phoneNumber);
                    if(phoneNumber.startsWith("+91")){
                        phoneNumber = phoneNumber.substring(3);
                        console.log(phoneNumber);
                    }
                    res.write(phoneNumber+'\n'+JSON.stringify(feed.feed.entry[i].title.$t));
                    res.write('\n\n');
                }
            }
            res.end();
        });
});

app.listen(3000, function () {
    console.log('Example app listening on port 3000!');
});