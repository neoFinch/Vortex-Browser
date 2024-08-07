# Vortex-Browser
A web-browser built using Electron JS

## Platform supported
MacOS

## Features Implemented
1. Create / Delete Tab
2. Navigate back and forward
3. Toggle Sidebar
4. Resize the window
5. Shortcuts for creating a new tab, and deleting a tab [CMD + T, CMD + W].
6. Reload Tab functionality
7. Ability to access Developer Tools
8. Search in a web page using [CMD + F]


## Features not implemented
1. Restore a deleted tab using [CMD + SHIFT + T]
2. ... and a lot more which I might not be aware of :)

## How it looks
### On MacOS
<img width="1440" alt="Screenshot 2024-07-14 at 2 52 20 PM" src="https://github.com/user-attachments/assets/e509aae9-ebb5-4dde-ac9d-c780b71e786d">

### On Ubuntu
![Screenshot from 2024-07-17 14-08-10](https://github.com/user-attachments/assets/c39c01d1-bd46-425c-bfad-d9976cfbf635)


## How to setup
1. Clone the repo
2. Run command `npm install`
3. To create build run `npm run make`
   -  It will generate appropriate executables based on your system (mac, linux, windows) in the `out` directory.
5. To run in Dev Mode with auto-reloading - run command `npx electronmon .`
6. To run in Dev Mode without auto-reload - run command `npm run start`

