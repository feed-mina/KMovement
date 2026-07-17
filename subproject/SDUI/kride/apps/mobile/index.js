// Local entry so Metro's dev-server bundle URL stays inside the project root
// (apps/mobile). `expo-router/entry` is hoisted to the workspace root node_modules;
// referencing it directly as `main` produced a `..\..\node_modules\...` bundle URL
// that fails to serve on Windows. Importing it from a local file keeps the entry
// path local while still running expo-router's registration.
import 'expo-router/entry';
