var express = require('express');
var app = express();
var path = require('path');
var bodyParser = require('body-parser');
var jsforce = require('jsforce'); //used for Salesforce Connection 

//global variables
var sfAccessToken = '';
var sfInstanceURL = '';
var contactEntryList = [];

//Environment Config Variables
var config = require('./config');

app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

//Google Contacts API Client auth
var client = require('gdata-js')(config.GOOGLE.apiKey, config.GOOGLE.apiSecret, 'https://salesforce-gsync.herokuapp.com/authenticate');
//var client = require('gdata-js')(config.GOOGLE.apiKey, config.GOOGLE.apiSecret, 'http://localhost:3000/authenticate');

//Salesforce Connection using jsForce
var conn = new jsforce.Connection({
    loginUrl: 'https://login.salesforce.com'
});

conn.login(config.SALESFORCE.username, config.SALESFORCE.password, function (err, userInfo) {
    if (err) { return console.error(err); }
    // Now you can get the access token and instance URL information.
    // Save them to establish connection next time.
    sfAccessToken = conn.accessToken;
    sfInstanceURL = conn.instanceUrl;

    console.log(conn.accessToken);
    console.log(conn.instanceUrl);
    // logged in user property
    console.log("User ID: " + userInfo.id);
    console.log("Org ID: " + userInfo.organizationId);
});

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/authenticate', function (req, res) {
    var token = '';
    var scope = 'https://www.google.com/m8/feeds/'; //contacts
    client.getAccessToken({
        scope: scope,
        access_type: 'online',
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
});

app.get('/getStuff', function (req, res) {
    contactEntryList = [];

    client.getFeed('https://www.google.com/m8/feeds/contacts/default/full', { 'max-results': 100 },
        function (err, feed) {
            for (var i in feed.feed.entry) {
                var contactEntry = {};
                if (feed.feed.entry[i].gd$phoneNumber != undefined) {
                    var phoneNumber = '' + JSON.stringify(feed.feed.entry[i].gd$phoneNumber[0].$t).replace(/ /g, '');
                    console.log(phoneNumber);
                    if (phoneNumber.startsWith("+91")) {
                        phoneNumber = phoneNumber.substring(3);
                        console.log(phoneNumber);
                    }
                    //res.write(phoneNumber + '\n' + JSON.stringify(feed.feed.entry[i].title.$t));
                    //res.write('\n\n');
                    contactEntry.name = JSON.stringify(feed.feed.entry[i].title.$t);
                    contactEntry.phone = phoneNumber;
                    contactEntryList.push(contactEntry);
                }
            }

            //SOQL Queries
            var records = [];
            conn.query("SELECT Id, Name, Phone FROM Account", function (err, result) {
                if (err) { return console.error(err); }
                console.log("total : " + result.totalSize);
                console.log("fetched : " + result.records[0].Name);
                records = result.records;

                var accountList = [];
                for (var cEntry in contactEntryList) {
                    var acc = {};
                    acc.Name = JSON.parse(contactEntryList[cEntry].name);
                    acc.Phone = JSON.parse(contactEntryList[cEntry].phone);
                    var isExists = false;
                    for (var rec in records) {
                        if (records[rec].Name == acc.Name && records[rec].Phone == acc.Phone) {
                            isExists = true;
                            break;
                        } else {
                            continue;
                        }
                    }
                    if (!isExists) { accountList.push(acc) };
                }
                console.log('accountList..' + JSON.stringify(accountList));

                //insert into Salesforce Accounts
                conn.sobject("Account").create(accountList,
                    function (err, rets) {
                        if (err) { return console.error(err); }
                        for (var i = 0; i < rets.length; i++) {
                            if (rets[i].success) {
                                console.log("Created record id : " + rets[i].id);
                            }
                        }
                    });
            });


            //redirect to show contacts page
            res.redirect('/showContacts');

        });
});


//display Contacts fetched from Google
app.get('/showContacts', function (req, res) {
    res.render('contact.ejs', { contacts: contactEntryList });
});

//start server
app.listen(process.env.PORT || 3000, function () {
    console.log('Example app listening on port 3000!');
});