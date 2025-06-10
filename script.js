const GRAPHQL_ENDPOINT = "https://01.gritlab.ax/api/graphql-engine/v1/graphql";
const AUTH_ENDPOINT = "https://01.gritlab.ax/api/auth/signin";

let jwt = null;

// DOM Elements
const loginContainer = document.getElementById("login-container");
const profileContainer = document.getElementById("profile-container");
const userLogin = document.getElementById("user-login");
const firstName = document.getElementById("first-name");
const lastName = document.getElementById("last-name");
const auditRatio = document.getElementById("audit-ratio");
const totalXP = document.getElementById("total-xp");
const loginError = document.getElementById("login-error");
const collaborators = document.getElementById("collaborators");

// GraphQL Query
const userQuery = `
{
  user {
    login
    attrs
    auditRatio
  }
  wip: progress (
    where: { isDone: { _eq: true }, grade: { _is_null: false } }
  ) {
    group {
      members {
        userLogin
      }
    }
  }
  transaction {
    path
    amount
    type
  }
}`;

// --- LOGIN / LOGOUT ---

async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const credentials = btoa(`${username}:${password}`);

  // network request with Authorization header
  try {
    const res = await fetch(AUTH_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}` },
    });

    if (!res.ok) throw new Error("Invalid credentials");

    //if credentials ok, server should respond with JSON Web Token
    jwt = await res.json();
    localStorage.setItem("jwt", jwt);
    loginContainer.classList.add("hidden");
    profileContainer.classList.remove("hidden");
    loadProfile();
  } catch (err) {
    loginError.textContent = err.message;
  }
}

function logout() {
  localStorage.removeItem("jwt");
  location.reload();
}

// --- DATA FETCHING ---

async function executeGraphql(query) {
  const token = localStorage.getItem("jwt");

  try {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      console.error(errorData);
      throw new Error(errorData.error || "GraphQL error");
    }

    const data = await res.json();
    console.log(data);
    return data;
  } catch (error) {
    console.error("Fetch error:", error);
    alert("An error occurred while fetching data.");
  }
}

// --- MAIN PROFILE LOGIC ---

async function loadProfile() {
  const { data } = await executeGraphql(userQuery);
  const user = data.user[0];
  const transactions = data.transaction;
  const wip = data.wip;

  // Profile info
  userLogin.textContent = user.login;
  firstName.textContent = user.attrs.firstName;
  lastName.textContent = user.attrs.lastName;
  auditRatio.textContent = user.auditRatio.toFixed(2);

  const groupMembers = new Set(); // used for getting collaborators
  wip
    .filter(entry => entry.group)
    .forEach(entry => {
      entry.group.members.forEach(member => {
        if (member.userLogin !== user.login) {
          groupMembers.add(member.userLogin);
        }
      });
    });

  collaborators.textContent = Array.from(groupMembers).join(", ");

  // XP filters
  const isXp = t => t.type === "xp";
  const startsWith = prefix => t => t.path.startsWith(prefix);
  const notIncludes = str => t => !t.path.includes(str);

  // "all xp's that count"
  const xpTransactions = transactions.filter(
    t =>
      isXp(t) &&
      startsWith("/gritlab/school-curriculum/")(t) &&
      (notIncludes("/piscine-js/")(t) || t.path === "/gritlab/school-curriculum/piscine-js")
  );

  const xpProjects = xpTransactions.filter(
    t =>
      ![
        "/piscine-js",
        "/piscine-go/",
        "/checkpoint",
      ].some(excluded => t.path.includes(excluded))
  );

  const xpGoCheckpoints = xpTransactions.filter(
    t => startsWith("/gritlab/school-curriculum/checkpoint/")(t)
  );

  const xpJSCheckpoints = xpTransactions.filter(
    t => startsWith("/gritlab/school-curriculum/checkpoint-js")(t)
  );

  const xpJSPiscine = xpTransactions.filter(
    t => t.path === "/gritlab/school-curriculum/piscine-js"
  );

  // Count sum
  const sumXp = arr => arr.reduce((sum, t) => sum + t.amount, 0);
  const totalXp = sumXp(xpTransactions);
  const totalJSCheckpointXp = sumXp(xpJSCheckpoints);
  const totalGoCheckpointXp = sumXp(xpGoCheckpoints);
  const totalProjectsXp = sumXp(xpProjects);
  const jsPiscineXp = sumXp(xpJSPiscine);

  totalXP.textContent = (totalXp / 1000).toFixed(2);

// draw svg
  drawXpBarChart(xpProjects);
  drawXpPieChart(totalJSCheckpointXp, totalGoCheckpointXp, totalProjectsXp, jsPiscineXp);
}

function drawXpBarChart(xpProjects) {
  const svg = document.getElementById("xp-bar");
  svg.innerHTML = "";
  if (!xpProjects.length) return;

  const width = svg.width.baseVal.value;
  const height = svg.height.baseVal.value;
  const margin = { top: 30, bottom: 60 };
  const maxXp = Math.max(...xpProjects.map(t => t.amount));
  const barSpacing = 2;
  const barWidth = Math.max((width - 2 * margin.top) / xpProjects.length - barSpacing, 1);

xpProjects.forEach((t, i) => {
    const barHeight = (t.amount / maxXp) * (height - margin.top - margin.bottom);
    const x = margin.top + i * (barWidth + barSpacing);
    const y = height - margin.bottom - barHeight;
    const label = t.path.split("/").pop().replace(/-/g, " ");

    svg.innerHTML += `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" class="xp-bar" />
      <text x="${x + barWidth / 2}" y="${y - 5}" font-size="10" text-anchor="middle" fill="#000">${(t.amount / 1000).toFixed(2)}</text>
      <text x="${x + barWidth / 2}" y="${height - 30}" font-size="10" text-anchor="middle" transform="rotate(-30 ${x + barWidth / 2},${height - 30})">${label}</text>
    `;
  });
}

function drawXpPieChart(jsXp, goXp, projectsXp, piscineXp) {
  const svg = document.getElementById("xp-pie");
  svg.innerHTML = "";

  const data = [
    { label: "Go-checkpoints", value: goXp, color: "#8bc34a" },
    { label: "Js-checkpoints", value: jsXp, color: "#e91e63" },
    { label: "Js-piscine", value: piscineXp, color: "#ffa500" },
    { label: "Projects", value: projectsXp, color: "black" },
  ];

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (!total) return;

  const cx = 75, cy = 75, radius = 60;
  let startAngle = 0;

  data.forEach(d => {
    const angle = (d.value / total) * 2 * Math.PI;
    const [x1, y1] = [cx + radius * Math.cos(startAngle), cy + radius * Math.sin(startAngle)];
    const [x2, y2] = [cx + radius * Math.cos(startAngle + angle), cy + radius * Math.sin(startAngle + angle)];
    const largeArc = angle > Math.PI ? 1 : 0;

    svg.innerHTML += `
      <path d="M${cx},${cy} L${x1},${y1} A${radius},${radius} 0 ${largeArc} 1 ${x2},${y2} Z" fill="${d.color}" />
    `;

    startAngle += angle;
  });

  const legendX = cx + radius + 20;
  let legendY = cy - radius;

  data.forEach(d => {
    svg.innerHTML += `
      <rect x="${legendX}" y="${legendY}" width="15" height="15" fill="${d.color}" />
      <text x="${legendX + 20}" y="${legendY + 12}" font-family="Arial" font-size="14">${d.label}: ${(d.value / 1000).toFixed(2)}</text>
    `;
    legendY += 25;
  });
}
