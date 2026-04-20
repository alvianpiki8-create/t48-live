// Generate a unique device fingerprint
export const getDeviceId = (): string => {
  const KEY = "teamlive_device_id";
  let id = localStorage.getItem(KEY);
  if (id) return id;

  // Generate a random device ID
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  id = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
  localStorage.setItem(KEY, id);
  return id;
};
