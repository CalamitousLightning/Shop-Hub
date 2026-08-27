/* =========================================================
   LUC Marketplace — login.js
   Customer email/password login & signup via Supabase Auth.
   Supports ?redirect=checkout so checkout.html can send
   unauthenticated shoppers here and bring them right back.
   ========================================================= */

const supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const loginSection = document.getElementById("loginSection");
const signupSection = document.getElementById("signupSection");
const loggedInSection = document.getElementById("loggedInSection");

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");
const loginError = document.getElementById("loginError");
const signupError = document.getElementById("signupError");
const signupSuccess = document.getElementById("signupSuccess");
const loggedInEmail = document.getElementById("loggedInEmail");
const logoutBtn = document.getElementById("logoutBtn");

function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");
  return redirect === "checkout" ? "checkout.html" : "index.html";
}

function showView(view) {
  loginSection.hidden = view !== "login";
  signupSection.hidden = view !== "signup";
  loggedInSection.hidden = view !== "loggedin";
}

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    loggedInEmail.textContent = session.user.email;
    showView("loggedin");
  } else {
    showView("login");
  }
}

document.getElementById("showSignup").addEventListener("click", (e) => {
  e.preventDefault();
  showView("signup");
});
document.getElementById("showLogin").addEventListener("click", (e) => {
  e.preventDefault();
  showView("login");
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  const btn = document.getElementById("loginBtn");
  btn.disabled = true;
  btn.textContent = "Logging in...";

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = "Log In";

  if (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
    return;
  }

  window.location.href = getRedirectTarget();
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  signupError.hidden = true;
  signupSuccess.hidden = true;

  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const phone = document.getElementById("signupPhone").value.trim();
  const password = document.getElementById("signupPassword").value;

  const btn = document.getElementById("signupBtn");
  btn.disabled = true;
  btn.textContent = "Creating account...";

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name, phone: phone },
    },
  });

  btn.disabled = false;
  btn.textContent = "Sign Up";

  if (error) {
    signupError.textContent = error.message;
    signupError.hidden = false;
    return;
  }

  // If email confirmation is off, Supabase returns a session immediately.
  if (data.session) {
    window.location.href = getRedirectTarget();
    return;
  }

  signupSuccess.textContent = "Account created! Please check your email to confirm, then log in.";
  signupSuccess.hidden = false;
  signupForm.reset();
  setTimeout(() => showView("login"), 2500);
});

logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  showView("login");
});

checkSession();
