1. clone the flamekeeper repo - https://github.com/AvneeshSarwate/flamekeeper
2. make an airtable account - https://airtable.com/
3. generate an api key (https://support.airtable.com/hc/en-us/articles/219046777-How-do-I-get-my-API-key-)
4. make a .env file in the root directory of the repo that looks like
```
AIRTABLE_API_KEY=[your-key]
EXPRESS_SESSION_SECRET=[any_random_string_you_want]
LOCAL_STATE_PATH=state.json
STOP_GHOST=true
 ```
5. get added to the new base and swap that base-id (appDMw3lOAQTw8dGQ) into airtable.js (in the `baseID` variable at line 5);
6. run `npm start` and then go to `http://localhost:8000/` and the installation should load