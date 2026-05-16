import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";

const DOWNLOADS_SAF_KEY = "pinewood_android_downloads_saf_uri";

/**
 * Salva un file locale (file://) nella cartella Download dell'utente.
 * Android: SAF sulla cartella Download (permesso richiesto una volta).
 * iOS: cartella documenti dell'app (visibile in File > Pinewood se abilitato).
 */
export async function saveFileToDownloads(sourceUri, fileName) {
  const safeName = String(fileName || "file")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_");
  const hasExt = /\.[a-z0-9]+$/i.test(safeName);
  const fullName = hasExt ? safeName : `${safeName}.gpx`;
  const baseName = fullName.replace(/\.[^.]+$/, "");
  const ext = fullName.includes(".") ? fullName.split(".").pop().toLowerCase() : "gpx";

  const mimeByExt = {
    gpx: "application/gpx+xml",
    xml: "application/xml",
    json: "application/json",
  };
  const mimeType = mimeByExt[ext] || "application/octet-stream";

  if (Platform.OS === "android") {
    const { StorageAccessFramework } = FileSystem;
    let downloadsDir = await SecureStore.getItemAsync(DOWNLOADS_SAF_KEY);
    if (!downloadsDir) {
      const initial = StorageAccessFramework.getUriForDirectoryInRoot("Download");
      const perm = await StorageAccessFramework.requestDirectoryPermissionsAsync(initial);
      if (!perm.granted) {
        throw new Error("Permesso alla cartella Download non concesso.");
      }
      downloadsDir = perm.directoryUri;
      await SecureStore.setItemAsync(DOWNLOADS_SAF_KEY, downloadsDir);
    }

    const destUri = await StorageAccessFramework.createFileAsync(
      downloadsDir,
      baseName,
      mimeType,
    );
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
    return { uri: destUri, location: "downloads" };
  }

  const dir = `${FileSystem.documentDirectory}Download/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  const dest = `${dir}${fullName}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return { uri: dest, location: "app_documents" };
}
