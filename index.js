var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var cheerio = require('cheerio');
var app = express();

app.use(bodyParser.urlencoded({
    extended: false
}));

app.use(bodyParser.json());

app.listen((process.env.PORT || 3000));

// Server frontpage
app.get('/', function(req, res) {
    res.send('This is TestBot Server');
});

// Facebook Webhook
app.get('/webhook', function(req, res) {
    if (req.query['hub.verify_token'] === process.env.PAGE_ACCESS_TOKEN) {
        res.send(req.query['hub.challenge']);
    } else {
        res.send('Invalid verify token');
    }
});

app.post('/webhook', function(req, res) {
    var data = req.body;

    // Make sure this is a page subscription
    if (data.object !== 'page') {
    	return;
    }

    // Iterate over each entry - there may be multiple if batched
    data.entry.forEach(function(entry) {
        
        // Iterate over each messaging event
        entry.messaging.forEach(function(event) {
            if (event.message) {
                var messageText = event.message.text;

			   	if (messageText) {
			    	buildResponse(messageText, event.sender.id);
				}
            } else {
                console.log("Webhook received unknown event: ", event);
            }
        });
    });
    res.sendStatus(200);
});

function buildResponse (messageText, senderID) {
	var temp = messageText.split(' ');
	
	getFilmwebMessages(checkGenre(temp[0].toLowerCase()), temp[1], senderID);

	function checkGenre (messageText) {
		var genres = {
			"animacja" : 2,
	        "dokumentalny": 5,
	        "dramat" : 6,
	        "familijny": 8,
	        "fantasy": 9,
	        "horror": 12,
	        "komedia": 13,
	        "kryminał": 15,
	        "melodramat": 16,
	        "obyczajowy": 19,
	        "przygodowy": 20,
	        "sensacyjny": 22,
	        "thriller": 24,
	        "western": 25,
	        "akcja" : 28
		}
		return genres[messageText];
	}
}

function getFilmwebMessages(genreIds, year, recipientId) {
    url = 'http://www.filmweb.pl/search/film?&q=&genreIds='+ genreIds + '&startYear='+ year + '&endYear=' + year + '&sort=COUNT&sortAscending=false';
    
    request(url, function(error, response, html) {
        if (error) {
            return {}
        }

        var messages = [];
        var $ = cheerio.load(html);

        $('.sep-hr.resultsList').filter(function() {
            $(this).children().each(function(i, elem) {
                if (i > 10) {
                    return;
                }
                messages.push({
                    title: $(elem).find('.filmTitle').text().substring(0, 70),
                    subtitle: $(elem).find('.filmPlot p').text().substring(0, 70),
                    item_url: $(elem).find('.entityTitle a').attr('src'),
                    image_url: $(elem).find('.entityPoster img').attr('src'),
                    buttons: [{
			            type: "web_url",
			            url: "http://www.filmweb.pl/" + $(elem).find('.gwt-filmPage').attr('href'),
			            title: "Otworz na filmweb'ie"
			        }, 
			        {
			            type: "web_url",
			            url: "http://www.filmweb.pl/" + $(elem).find('.gwt-filmPage').attr('href'),
			            title: "Trailer"
			        },
			        {
			            type: "postback",
			            title: "Oznacz jako obejrzane",
			            payload: "Payload for first bubble",
			        }]
                });
            });
        });

        var messageData = {
            recipient: {
                id: recipientId
            },
            message: {
                attachment: {
                    type: "template",
                    payload: {
                        template_type: "generic",
                        elements: messages
                    }
                }
            }
        };

        callSendAPI(messageData);
    });
}

function callSendAPI(messageData) {
	console.log(messageData);
    request({
        uri: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {
            access_token: process.env.PAGE_ACCESS_TOKEN
        },
        method: 'POST',
        json: messageData

    }, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            // var recipientId = body.recipient_id;
            // var messageId = body.message_id;
        } else {
            console.error("Unable to send message.");
            console.error(response);
            console.error(error);
        }
    });
}
