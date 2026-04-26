# TODO List

## Bug fixes and small improvements ( do these first)

[ ] - Do not allow users to submit financing form without a license front and back, it is not optional, mark as required on the form and show an error message if they try to continue without it.
[ ] - Employer information should be required, and marked required on the form, and should include postal code.
[ ] - unable to add user from the admin panel got a 302 msg=Failed to add user. Please try again. this is not fixed.
[ ] - validation on postal code and phone number format should show that the format is incorrect, not just that the field is required.
[ ] - addresses and employment history date should be exact date range, not living at place since or working at place since
[ ] - send confirmation email to user when application is submitted, do not include PII
[ ] - updating status to document incomplete doesn't work, it just refreshes and stays at the previous status, updating to other statuses works fine.
[ ] - loosen up rate limit on file uploads and form submissions.

## Long Term Features ( do not do yet)

[ ] - Migrate away from Wordpress as a CMS for static pages (About, Contact, FAQ, Blog) to reduce costs and maintenance overhead.
[ ] - build a full Dealer Management System for us to use including inventory management, application review . This would replace a bunch of google sheets that we are using. The vehicles in the inventory would be automatically pulled, including vehicle images, and we would need to update vehicle status into the website and we could have a dashboard to manage applications, customers, and inventory all in one place.
