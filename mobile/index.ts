// The app starts here. expo-router comes first (on the web its runtime must load first).
// Then the background reminder refresh is defined: Android can start the app in the background only to run
// that task, and a task has to be defined when the app's code first loads, not inside a screen.
import "expo-router/entry";
import "./src/lib/background-sync";
