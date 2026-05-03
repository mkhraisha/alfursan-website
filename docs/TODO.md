# TODO List

## Bug fixes and small improvements ( do these first)

[ ] - Do not allow users to continue the financing form without a license front and back, it is not optional, mark as required on the form and show an error message if they try to continue without it.
[ ] - Employer information should be required, and marked required on the form, and should include postal code, and the user should not be allowed to continue without filling it out, show an error message if they try to continue without it.
[ ] - validation on postal code and phone number format should show that the format is incorrect, not just that the field is required.
[ ] - addresses and employment history date should be exact date range, not living at place since or working at place since
[ ] - send confirmation email to user when application is submitted, do not include PII just include the same information referene number and contact us information.
[ ] - updating status to document incomplete doesn't work, it just refreshes and stays at the previous status, updating to other statuses works fine, this is because the phase2 token is not being populated when the application is submitted, so when we try to update to document incomplete it tries to send an email with a link that includes the phase2 token but since it's not populated it throws an error and doesn't update the status, we need to fix this by making sure the phase2 token is populated when the application is submitted.
[ ] - loosen up rate limit on file uploads and form submissions.
