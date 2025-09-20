// ------------------- Contract Setup -------------------
const contractAddress = "0x8B631b8F6BB2A96fBA3C0561C4Bd31A9b077BCA9";
const contractABI = [
  { "inputs":[{"internalType":"address","name":"_admin","type":"address"}],"name":"addAdmin","outputs":[],"stateMutability":"nonpayable","type":"function" },
  {"inputs":[],"stateMutability":"nonpayable","type":"constructor"},
  { "anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"admin","type":"address"}],"name":"AdminAdded","type":"event" },
  { "anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"docHash","type":"string"},{"indexed":false,"internalType":"address","name":"by","type":"address"}],"name":"DocumentUploaded","type":"event" },
  { "inputs":[{"internalType":"string","name":"docHash","type":"string"}],"name":"uploadDocument","outputs":[],"stateMutability":"nonpayable","type":"function" },
  { "inputs":[{"internalType":"address","name":"","type":"address"}],"name":"admins","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function" },
  { "inputs":[{"internalType":"string","name":"","type":"string"}],"name":"documents","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function" },
  { "inputs":[{"internalType":"string","name":"docHash","type":"string"}],"name":"verifyDocument","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function" }
];

// ------------------- Providers & DOM Elements -------------------
const RPC_URL = "https://sepolia.infura.io/v3/a1e9905236e14dcf8483d0db3109789c";
const readProvider = new ethers.providers.JsonRpcProvider(RPC_URL);

const form = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const submitButton = document.getElementById("submitButton");
const statusDiv = document.getElementById("status");

const adminContainer = document.getElementById("adminContainer");
const addAdminInput = document.getElementById("addAdminInput");
const addAdminButton = document.getElementById("addAdminButton");

// Admin message div
const adminStatusDiv = document.createElement("p");
adminStatusDiv.style.marginTop = "10px";
adminStatusDiv.style.fontWeight = "bold";
if (adminContainer) adminContainer.appendChild(adminStatusDiv);

// File text fallback
let fileText = document.getElementById("fileText");
if (!fileText) {
  fileText = document.createElement("span");
  fileText.id = "fileText";
  fileText.textContent = "Choose a PDF file";
  const fileLabel = document.querySelector(".file-label");
  if (fileLabel) fileLabel.appendChild(fileText);
  else if (fileInput && fileInput.parentNode) fileInput.parentNode.insertBefore(fileText, fileInput);
}

// ------------------- Utility Functions -------------------
async function getFileHash(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return "0x" + Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function checkAdminStatus(address) {
  const contractCheck = new ethers.Contract(contractAddress, contractABI, readProvider);
  try {
    return await contractCheck.admins(address);
  } catch (err) {
    console.error("checkAdminStatus error:", err);
    return false;
  }
}

// ------------------- PDF validation -------------------
async function validateFileOnlyPdf(file) {
  if (!file) throw new Error("No file provided.");
  if (file.type !== "application/pdf") throw new Error("Only PDF files are allowed.");

  const pdfjsLib = window.pdfjsLib || window['pdfjs-dist/build/pdf'] || null;
  if (!pdfjsLib) throw new Error("pdf.js not loaded. Include pdf.min.js before this script.");

  if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.worker.min.js";
  }

  const arrayBuffer = await file.arrayBuffer();
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    await loadingTask.promise;
  } catch {
    throw new Error("Failed to load PDF document.");
  }

  return true; // Allow image PDFs
}

// ------------------- UI helpers -------------------
function showStatus(msg, type = "info") {
  if (!statusDiv) return;
  statusDiv.textContent = msg;
  statusDiv.style.fontWeight = "bold";
  statusDiv.style.fontSize = "15px";
  statusDiv.style.padding = "10px";
  statusDiv.style.borderRadius = "10px";
  statusDiv.style.textAlign = "center";
  statusDiv.style.minHeight = "50px";

  switch(type) {
    case "success":
      statusDiv.style.background = "#e6f7e6";
      statusDiv.style.color = "#2b7a0b";
      statusDiv.style.border = "1px solid #2b7a0b";
      statusDiv.textContent = "✅ " + msg;
      break;
    case "error":
      statusDiv.style.background = "#ffe6e6";
      statusDiv.style.color = "#b00020";
      statusDiv.style.border = "1px solid #b00020";
      statusDiv.textContent = "❌ " + msg;
      break;
    case "warn":
      statusDiv.style.background = "#fff4e6";
      statusDiv.style.color = "#b76b00";
      statusDiv.style.border = "1px solid #b76b00";
      statusDiv.textContent = "⚠️ " + msg;
      break;
    default:
      statusDiv.style.background = "#e6f0ff";
      statusDiv.style.color = "#1a1a1a";
      statusDiv.style.border = "1px solid #667eea";
      statusDiv.textContent = "ℹ️ " + msg;
      break;
  }
}

// ------------------- Show File Name -------------------
if (fileInput) {
  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files.length > 0) {
      fileText.textContent = `📄 Selected File: ${fileInput.files[0].name}`;
    } else {
      fileText.textContent = "Choose a PDF file";
    }
  });
}

// ------------------- Main Logic -------------------
window.addEventListener("load", async () => {
  let signer = null;
  let userAddress = null;
  let isAdmin = false;

  try {
    let metamaskInstalled = false;
    if (window.ethereum) {
      metamaskInstalled = true;
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      try {
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();
        isAdmin = await checkAdminStatus(userAddress);
      } catch {
        // User declined access → treat as user
        signer = null;
        userAddress = null;
        isAdmin = false;
      }
    }

    // Update UI based on MetaMask + admin status
    updateUI(isAdmin);
    if (metamaskInstalled && isAdmin) {
      showStatus(`Connected successfully as admin: ${userAddress}`, "success");
    } else {
      showStatus("Select a PDF file to Upload ");
    }

    if (window.ethereum && typeof window.ethereum.on === "function") {
      window.ethereum.on("accountsChanged", async (accounts) => {
        if (accounts.length > 0) {
          userAddress = accounts[0];
          isAdmin = await checkAdminStatus(userAddress);
        } else {
          isAdmin = false;
        }
        updateUI(isAdmin);
        showStatus(isAdmin ? `Connected as admin: ${userAddress}` : "Verification-only mode active.", "warn");
      });
    }

    // Form submit
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const file = fileInput?.files?.[0];
        if (!file) {
          showStatus("Please select a PDF file to upload or verify.", "warn");
          return;
        }

        try {
          await validateFileOnlyPdf(file);
          showStatus("Calculating file hash. Please wait...", "info");
          const hash = await getFileHash(file);

          if (signer && isAdmin) {
            const contractRead = new ethers.Contract(contractAddress, contractABI, readProvider);
            const alreadyExists = await contractRead.verifyDocument(hash);
            if (alreadyExists) {
              showStatus(`This document already exists on blockchain.\nHash: ${hash}`, "warn");
              return;
            }

            const contractWrite = new ethers.Contract(contractAddress, contractABI, signer);
            showStatus("Uploading document via MetaMask...", "info");
            const tx = await contractWrite.uploadDocument(hash);
            showStatus("Waiting for transaction confirmation...", "info");
            await tx.wait();
            showStatus(`Document uploaded successfully!\nHash: ${hash}`, "success");
          } else {
            const contract = new ethers.Contract(contractAddress, contractABI, readProvider);
            const exists = await contract.verifyDocument(hash);
            if (exists) showStatus(`This document is verified as REAL!\nHash: ${hash}`, "success");
            else showStatus(`This document is NOT verified (FAKE)!\nHash: ${hash}`, "error");
          }
        } catch (err) {
          showStatus(`Error: ${err.message || err}`, "error");
        }
      });
    }

    // Add admin
    if (addAdminButton) {
      addAdminButton.addEventListener("click", async () => {
        if (!signer || !isAdmin) {
          adminStatusDiv.textContent = "You are not authorized to add a new admin.";
          return;
        }
        const newAdminAddress = addAdminInput?.value.trim() || "";
        if (!ethers.utils.isAddress(newAdminAddress)) {
          adminStatusDiv.textContent = "Please enter a valid Ethereum address.";
          return;
        }

        try {
          const alreadyAdmin = await checkAdminStatus(newAdminAddress);
          if (alreadyAdmin) {
            adminStatusDiv.textContent = "This address is already an admin.";
            return;
          }
          const contractWrite = new ethers.Contract(contractAddress, contractABI, signer);
          adminStatusDiv.textContent = `Adding new admin: ${newAdminAddress}...`;
          const tx = await contractWrite.addAdmin(newAdminAddress);
          await tx.wait();
          adminStatusDiv.textContent = `✅ Admin added successfully: ${newAdminAddress}`;
          addAdminInput.value = "";
        } catch (err) {
          if (err.code === 4001) {
            adminStatusDiv.textContent = "Add admin transaction canceled by user.";
          } else {
            console.error("addAdmin tx error:", err);
            adminStatusDiv.textContent = "Could not add admin. See console for details.";
          }
        }
      });
    }

  } catch (err) {
    console.error("Initialization error:", err);
    showStatus(`Initialization failed: ${err.message || err}`, "error");
  }

  // ------------------- UI updater -------------------
  function updateUI(isAdminLocal) {
    if (isAdminLocal) {
      if (adminContainer) adminContainer.style.display = "block";
      if (submitButton) {
        submitButton.innerText = "Upload Document (Admin)";
        submitButton.style.backgroundColor = "#4CAF50";
      }
    } else {
      if (adminContainer) adminContainer.style.display = "none";
      if (submitButton) {
        submitButton.innerText = "Verify Document (User)";
        submitButton.style.backgroundColor = "#2196F3";
      }
    }
  }
});
