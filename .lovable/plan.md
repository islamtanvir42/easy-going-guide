# Add UCB branding

## Goal
Add the supplied UCB logo to the authentication and dashboard screens while preserving the inventory system’s clean, compact layout.

## Changes
- Store the uploaded logo as a project media asset and reuse the same source on both screens.
- Place a clear, proportionally sized logo above the sign-in/create-account heading.
- Add a smaller logo at the left of the dashboard header, aligned with the existing title and scan/account controls.
- Keep the existing page wording, authentication behavior, dashboard data, and permissions unchanged.
- Create a padded square favicon from the supplied mark and replace the current default browser icon.
- Check the sign-in and dashboard at desktop and mobile sizes to ensure the logo remains sharp, uncropped, and does not crowd nearby text or controls.

## Technical details
- Reference the uploaded image through the project asset system for page use.
- Use the real uploaded image directly only for the small favicon copy required by browsers.
- Add descriptive alternative text and responsive size constraints.
- Verify the project compiles and the two screens render correctly.