/** Session flag: user has uploaded or confirmed resume content on the prepare page. */
export const RESUME_UPLOADED_SESSION_KEY = "jobhunter_resume_uploaded";

export function readResumeUploadedFromSession(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(RESUME_UPLOADED_SESSION_KEY) === "1";
}

export function writeResumeUploadedToSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(RESUME_UPLOADED_SESSION_KEY, "1");
}

export function clearResumeUploadedFromSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RESUME_UPLOADED_SESSION_KEY);
}
