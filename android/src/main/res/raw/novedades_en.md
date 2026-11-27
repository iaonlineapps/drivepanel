# What's new in the DrivePanel Android app

## Version 1.6.9
- Choose which phone folders are uploaded: in Photo backup → “Phone folders” you see the list of folders (Camera, WhatsApp Images, Screenshots…) with how many photos each one has. Untick the ones you don't want to upload. For example, if you untick Camera, photos are uploaded when you move them to another folder.

## Version 1.6.8
- New **Photo backup** screen, in the style of Google Photos. At the top a circle shows the status (complete, copying with its %, paused, permission missing...). Below, the summary: photos and videos on the phone, how many are left and their size, and the last backup. Settings use switches.
- The backup recognises by itself what is already in DrivePanel and continues right where it stopped, even if it was cut halfway. It never uploads anything twice or overwrites a photo.
- Photos you move to another folder on the phone are uploaded too (to their new album folder).
- If a file cannot be read (for example a deleted one Android still lists), the backup skips it and carries on. Before, it got stuck on it.
- “Which photos are copied”: all the ones on the phone or only new ones from today. You can change it any time.

## Version 1.6.7
- Automatic photo backup no longer stops on long backups (many gigabytes): it now uploads as an “upload in progress” with its own notification, like Google Photos. It keeps going with the screen off and at night, and retries by itself if the connection drops.
- New “Don't stop when the screen is off” button: removes battery saving for DrivePanel so Android doesn't slow it down.
- While it copies and the app is open, the screen stays on.
- The backup screen shows how many photos and videos it sees on the phone and how many are still to copy. It also warns if the video permission is missing.
- Before uploading, it asks DrivePanel what it already has and skips it straight away, without sending it again.

## Version 1.6.6
- Fixed automatic photo backup when you use your own domain with https (for example behind Pangolin). If the saved address was http:// and the server sends you to https://, the app now saves the https one and photos upload on their own again. Nothing to do: just open the app once.
- Clearer photo backup: if the app can't see your photos (or only some of them), it now tells you instead of saying “Everything copied”, and “Copy now” asks for the permission. If you chose “Only new ones”, the status says from which day it copies, and there is an “Also copy the ones I already had” button. The status updates live when you tap “Copy now”.
- If you type a domain without http:// or https:// (for example drive.mydomain.com), the app uses https. A home IP (192.168.1.50:8090) still uses http.

## Version 1.6.5
- Download a folder as it is, without a .zip: tap Download on a folder and choose “As it is, with its subfolders”. The app downloads the files one by one to Download/<folder>, with their subfolders, and the downloads panel shows how many are done, the percentage and the time left. Files already there with the same size are skipped. Needs server 1.0.11 or newer.

## Version 1.6.4
- Disk full alert: if your DrivePanel server's disk is filling up, you get a notification on your phone even when the app is closed. It alerts once when it reaches “almost full” and again at “full” (the percentages are set on the website, in Settings). Needs server 1.0.8 or newer.
- The app's own screens (settings, downloads, photo backup, notifications) are now also in English. They use the same language you chose on the DrivePanel website; if you haven't chosen one, the phone's language.

## Version 1.6.3
- Automatic photo backup, like Google Photos: the app uploads new photos and videos from your phone to a DrivePanel folder, with a subfolder per album. You can choose wifi only, camera only and the folder. Turn it on with Back → “Automatic photo backup”.
- While copying you see live progress, like uploads: how many are done, percentage, speed graph and time left. You can pause, resume or cancel it from the app or from the notification.
- Videos can be played full screen (the phone rotates by itself).

## Version 1.6.2
- The downloads panel now has a summary like Windows 11: percentage complete, file being downloaded, live speed graph, time left and how many items remain.
- If you open DrivePanel in your phone's browser (for example from a Telegram link), tapping Download lets you choose “Open in the DrivePanel app” so it downloads in the app with its downloads panel.

## Version 1.6.1
- DrivePanel appears in Android's “Share” menu: share photos or files from the gallery, WhatsApp or any app, choose the folder and they upload with the uploads panel.
- The app opens straight to the Activity dashboard. If you prefer My Drive, press Back and choose “Start screen”.
- The start screen explains that you first need your own DrivePanel server installed, with a link showing how.

## Version 1.6
- Downloads panel, like the uploads one: it appears at the bottom when you tap Download and shows each file with its bar, progress, speed and time left.
- From the panel you can cancel a download, retry it if it fails or open the file when it's done.
- Downloads continue even if you close the app; when you come back, the panel shows how they're going.

## Version 1.5
- The app version is shown at the bottom of the side menu and in your user menu, even if the server isn't updated yet.

## Version 1.4
- The version is always visible: the server and app versions appear at the bottom of the side menu and in your user menu.

## Version 1.3
- You can now upload whole folders from your phone, with all their subfolders. In DrivePanel choose “Upload folder”, find the folder and tap “Use this folder”.

## Version 1.2
- You can now see which version you have and what's new: press Back on the main screen and choose “What's new”, or press and hold the app icon.
- The app tells you when there's a new version on GitHub and lets you download it.

## Version 1.1
- The example address now uses port 8090.
- Clear notice that the home IP only works on your home wifi; away from home you need the public address.

## Version 1.0
- First version: opens your DrivePanel, uploads files and photos, and downloads to the Downloads folder.
- Asks for the server address the first time and lets you change it.
