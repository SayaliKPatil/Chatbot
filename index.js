const bodyParser = require('body-parser');
const ConversationV1 = require('watson-developer-cloud/conversation/v1');
const express = require('express');
const redis = require('redis');
let client = redis.createClient();
const secrets = require('./secrets');

const twilioAccountSID = process.env.twilioAccountSID;
const twilioAuthToken = process.env.twilioAuthToken;
const twilio = require('twilio')(twilioAccountSID, twilioAuthToken);
const watsonWorkSpaceId = process.env.watsonWorkSpaceId;
const watsonServiceUsername = process.env.watsonServiceUsername;
const watsonServicePassword = process.env.watsonServicePassword;

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

function error (err) {
  if (err) console.error('Error: ', err);
 }

client.on('error', (err) => error(err));

app.post('/sms', (req, res, next) => {
  let customer = req.body.From;
  const twilioNumber = req.body.To;
  let text = req.body.Body;
  let context;

  console.log('Received message: ', text, ' from: ', customer);

  client.get(customer, (err, data) => {
    error(err);
    data = JSON.parse(data);
    if (data && customer === data.customer){
      context = data.context;
    }
    sendConversationToWatson(context);
  });

  // Set up Conversation service wrapper
  function sendConversationToWatson(context) {
    let conversation = new ConversationV1({
      username: watsonServiceUsername,
      password: watsonServicePassword,
      version_date: '2018-02-16'
    });

    // Start conversation with Watson with customer's initial text
    conversation.message({
      input: { text: text },
      workspace_id: watsonWorkSpaceId,
      context: context
    }, processResponse);

    // Process the conversation response
    function processResponse (err, response) {
      error(err);

      // update the context with the converesation
      let customerObj = {customer: customer, context: response.context};
      client.set(customer, JSON.stringify(customerObj));

      // respond back with a new message via Twilio
      twilio.messages.create({
        from: twilioNumber,
        to: customer,
        body: response.output.text[0]
      })
      .then(message => {
        console.log('Responding with: ', message.body);
      })
      .catch(err);
    }
  }
});

app.listen(3000, function () {
  console.log('Ready to go on port 3000!');
});
