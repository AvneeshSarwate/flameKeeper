## Goal/Overview

- To have a production ready app developed, debugged, and deployed on Heroku or some other comparable site.  The stack is Node.js, Pug, JS, and the Web Audio API (no database).  It is wired to two Amazon S3 buckets, one for audio, one for images.  The audio files are streamed directly from the Amazon bucket to the app to promote lightweight hosting when serving up the page.  The Web Audio API constructs the waveform renderings in the <script> tag of the index.pug file.  It is also used to serve up any additional panning/effects in the audio itself.
- Files are tracked in a group of .csv files, so no database is in play.  Just .csv files that house streaming links, a master list of uploaded files in the amazon bucket, and also composer information that is dynamically assigned and served to views through the controller.  Heroku is the chosen site to house the app, though any number of options are available, including a custom solution.

## Front End
- Fix visual rendering of 'installation' component of the index.pug file, specifically compatibility issues with Safari/Firefox/Chrome.  Errors arise with construction of polylines when running outside of Chrome
- When fullscreen button is pressed, installation component is brought to full, and when ESC key pressed, brought back to normal.  The background animation should stay consistent when brought to fullscreen and back.  This should also be cross-browser compatible.
- A more stylish overlay with the BEGIN button to fire up the installation.  (Web Audio needs user input to begin, so some type of triggering mechanism is necessary because Autoplay will not work).
- Additional stylings to buttons on homepage, as well as styling fixes on 'past composers' page to make the layout more elegant.
- All front end elements to be made mobile friendly
- Any other considerations from Jakub, et al., of necessary stylings and functionality

## Back End
- Server side forms should be styled and organized to promote ease of use for resident composers/interns.
- Additional lock functionalities on forms to prevent user from overriding any functions while current function is rendering (for example, not be able to click the back button after hitting 'REPLACE' in the ./dashboard).
- Debugging of any routing, redirect, login, or logout problems with back end
- Two users for auth0, one is a composer login to access './upload-form' and './dashboard', the other is the intern login to access './intern-form'.  Composers should NOT be able to access the intern form
- Any other bugs to be spotted and squashed, though it should mostly be ironed out.
- Any other considerations from Jakub, et al., of necessary stylings and functionality

## Other considerations
- A look at the Amazon S3 securities to ensure that no attacks can be made on the bucket or data, but is still accessible through forms on the app.
- Have the option to have local backups of bucket data run periodically in case of mistaken deletions (this may not be possible without manually doing this in S3).


# Setup Amazon S3 Buckets
You must construct/include a .env file with the proper S3 access key and also secret key.  You then need to create buckets and align them with the names in the app (fk-audio-dev and fk-composer-info-dev) or rename accordingly.
- https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/getting-started-nodejs.html#getting-started-nodejs-credentials

# Setup auth0 login credentials
You must register and set up auth0 permissions and include the AUTH0 client Id, Domain, and Secret in your .env file.  Additionally, you may exclude any Passport.js functionality and dependencies in order to properly build, and reinstate them later
- https://auth0.com/blog/create-a-simple-and-secure-node-express-app/

