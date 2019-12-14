# MMM-Postnord
Magic Mirror Module - Automatically track and trace PostNords letters, parcels and pallets with your phone number or email

Right now the module only supports incoming parcels. In the future support for tracking outgoing parcels will be included. 

## Install
1. Clone repository into ``../modules/`` inside your MagicMirror folder.
2. Run ``npm install`` inside ``../modules/MMM-Postnord/`` folder
3. Add the module to the MagicMirror config

## Update
1. Run ``git pull`` inside ``../modules/MMM-Postnord/`` folder.
2. Run ``npm install`` inside ``../modules/MMM-Postnord/`` folder

## Configuration
```
modules: [
    ...
    {
            module: "MMM-Postnord",
            position: "bottom_left",
            config: {
                locale: "sv", //Optional, default is 'sv' allowed codes 'en', 'da', 'fi', 'no', 'sv'
                refreshRateMin: "60" //Optional, default is 60 min
            }
        }
    ...
]
```
 
## Setup subscriptions
In order to automatically track letters, parcels and pallets based on your phone number or email you need to retrive an access token (hash). In order to-do that you need to run attached program called postnord-hash-generator.js after you have performed ``npm install``. Which will create a local subscription database entry for you. You could add multiple phone numbers or emails. 

### postnord-hash-generator.js
MMM-Postnord uses a local database (db.json) which will contain you subscription information, such as hash, email, phone number, refreshed time etc. In order to run the program you need to navigate to your locale module folder ``../modules/MMM-Postnord/``. Inside the folder run ``$ node postnord-hash-generator.js help``. You will now see what commands is supported and how you could run the diffrent commands. 
![Help](https://github.com/bureus/MMM-Postnord/blob/master/docs/help.png)

#### Create a new subscription
Run ``$ node postnord-hash-generator.js new`` this will prompt you to enter subscription id (supports phone number (example: 46727777777) or email (example: test@test.com), country and language seperated by SPACE. Please enter input like ``46727777777 SE sv``
![Subscription input](https://github.com/bureus/MMM-Postnord/blob/master/docs/subscriptioninput.png)

#### List subscriptions
Run ``$ node postnord-hash-generator.js list``, this will write out the database. Please ensure your subscription status is ``VERIFIED`` if not then please delete your subscription and try again.  
![Subscription input](https://github.com/bureus/MMM-Postnord/blob/master/docs/list.png)

#### Delete subscriptions
Run ``$ node postnord-hash-generator.js remove``, this will prompt you for the subscription id you would like to remove (either email or phone number). Enter the subscription id and press ``Enter``. This will remove the subscription from the database.
![Subscription input](https://github.com/bureus/MMM-Postnord/blob/master/docs/remove.png) 

### Supported languages
Default language is Swedish, but the module support english (en), norweigian (no), danish (da) and finish (fi).

## Screenshot

![Postnord Module](https://github.com/bureus/MMM-Postnord/blob/master/docs/screenshot.png)
