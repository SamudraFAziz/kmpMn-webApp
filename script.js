// --- FIREBASE IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut 
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot,
    query,
    doc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBBynuU7RUKJqAGrb3D9zU5AyOU9iJbQvY",
    authDomain: "kmpdataapp.firebaseapp.com",
    projectId: "kmpdataapp",
    storageBucket: "kmpdataapp.firebasestorage.app",
    messagingSenderId: "1079100933572",
    appId: "1:1079100933572:web:94c778728645a70de35091",
    measurementId: "G-CD5NWYDNNM"
};

// --- APPLICATION CONSTANTS ---
const prices = {
    goat: { 'Hemat': 1699000, 'Hikmat': 2499000, 'Hebat': 2999000 },
    cow_whole: { 'Hemat': 13900000, 'Hikmat': 16000000, 'Hebat': 21000000 },
    cow_share: { 'Retail': 1799000 }
};
const sources = ['Masjid Nusantara', 'Kitabisa', 'Amal Sholeh', 'Sharing Happiness', 'Launch Good', 'Lainnya'];

// --- INITIALIZE FIREBASE ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- GLOBAL STATE ---
let currentUser = null;
let userRole = 'guest';
let allDonations = [];
let targets = {};
let allUsers = [];
let unsubscribe = null;
let currentRawPrice = 0; // To hold the unformatted total price for submission

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    applySidebarPreference();
    showPage('dashboard');
    lucide.createIcons();
});

function setupEventListeners() {
    // Sidebar
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('is-expanded');
        localStorage.setItem('sidebar-expanded', sidebar.classList.contains('is-expanded'));
        updateMainContentMargin();
    });

    document.querySelectorAll('.sidebar-icon[data-page]').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = icon.getAttribute('data-page');
            showPage(pageId);
            if (pageId === 'user-management' && userRole === 'admin') {
                fetchUsers();
            }
        });
    });

    // Auth & Modals
    document.getElementById('loginBtn').addEventListener('click', () => openModal('loginModal'));
    document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
    document.getElementById('closeLoginBtn').addEventListener('click', () => closeModal('loginModal'));
    document.getElementById('confirmLoginBtn').addEventListener('click', handleLogin);
    
    // Forms
    document.getElementById('donation-form').addEventListener('submit', handleFormSubmit);
    document.getElementById('donation-type').addEventListener('change', handleDonationTypeChange);
    document.getElementById('donation-tier').addEventListener('change', updatePrice);
    document.getElementById('quantity').addEventListener('input', updatePrice); // Recalculate on quantity change
    document.getElementById('discount').addEventListener('input', updatePrice); // Recalculate on discount change
    document.getElementById('edit-form').addEventListener('submit', handleEditSubmit);
    document.getElementById('closeEditBtn').addEventListener('click', () => closeModal('editModal'));
    document.getElementById('targets-form').addEventListener('submit', handleTargetFormSubmit);

    // Search
    document.getElementById('stock-search-input').addEventListener('keyup', filterAndRenderData);
    document.getElementById('rekap-search-input').addEventListener('keyup', filterAndRenderData);
    
    // Export Buttons
    document.getElementById('export-stock-csv').addEventListener('click', () => exportData('stock', 'csv'));
    document.getElementById('export-stock-xlsx').addEventListener('click', () => exportData('stock', 'xlsx'));
    document.getElementById('export-rekap-csv').addEventListener('click', () => exportData('rekap', 'csv'));
    document.getElementById('export-rekap-xlsx').addEventListener('click', () => exportData('rekap', 'xlsx'));
}

// --- MODAL HANDLING ---
const openModal = (modalId) => document.getElementById(modalId).classList.remove('hidden');
window.closeModal = (modalId) => document.getElementById(modalId).classList.add('hidden');

// --- SIDEBAR ---
function applySidebarPreference() {
    const isExpanded = localStorage.getItem('sidebar-expanded') === 'true';
    if (isExpanded) document.getElementById('sidebar').classList.add('is-expanded');
    updateMainContentMargin();
}

function updateMainContentMargin() {
    const mainContent = document.getElementById('main-content');
    const sidebar = document.getElementById('sidebar');
    mainContent.style.marginLeft = sidebar.classList.contains('is-expanded') ? '16rem' : '5rem';
}

// --- PAGE NAVIGATION ---
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    document.querySelectorAll('.sidebar-icon[data-page]').forEach(icon => icon.classList.remove('active'));
    document.querySelector(`.sidebar-icon[data-page='${pageId}']`).classList.add('active');
    
    const titles = { 
        dashboard: 'Dasbor', 
        'data-entry': 'Input Data', 
        stock: 'Data & Stok Hewan', 
        allocation: 'Alokasi', 
        rekap: 'Rekap', 
        targets: 'Atur Target',
        'user-management': 'Manajemen Pengguna'
    };
    document.getElementById('page-title').textContent = titles[pageId] || 'Dasbor';
}

// --- AUTHENTICATION ---
async function handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    if (!email || !password) return showToast("Silakan masukkan email dan kata sandi.", "error");
    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal('loginModal');
        showToast("Berhasil masuk!", "success");
    } catch (error) {
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
            try {
                await createUserWithEmailAndPassword(auth, email, password);
                closeModal('loginModal');
                showToast("Pengguna baru dibuat dan berhasil masuk.", "success");
            } catch (createError) {
                showToast(`Gagal membuat pengguna: ${createError.message}`, "error");
            }
        } else {
             showToast(`Gagal masuk: ${error.message}`, "error");
        }
    }
}

onAuthStateChanged(auth, async (user) => {
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (user) {
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
            userRole = userDocSnap.data().role;
        } else {
            const newRole = user.email === 'admin@kmp.com' ? 'admin' : 'staff';
            try {
                await setDoc(userDocRef, {
                    email: user.email,
                    role: newRole,
                    createdAt: serverTimestamp()
                });
                userRole = newRole;
            } catch (error) {
                console.error("Error creating user profile:", error);
                showToast("Gagal membuat profil pengguna.", "error");
                userRole = 'guest';
            }
        }
        
        currentUser = user;
        document.getElementById('userInfo').innerHTML = `Masuk sebagai: <strong>${user.email}</strong> <br> Peran: <span class="font-bold text-indigo-600">${userRole.toUpperCase()}</span>`;
        attachFirestoreListener();

    } else {
        currentUser = null;
        userRole = 'guest';
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        document.getElementById('userInfo').textContent = 'Belum masuk.';
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        clearAllDataUI();
    }
    updateUIForRole();
});


// --- ROLE-BASED UI ---
function updateUIForRole() {
    const adminContent = document.getElementById('admin-content');
    const adminNotice = document.getElementById('admin-notice');
    const dataEntryPage = document.getElementById('data-entry');
    
    const targetsAdminContent = document.getElementById('targets-admin-content');
    const targetsAdminNotice = document.getElementById('targets-admin-notice');
    const navTargets = document.getElementById('nav-targets');

    const userManagementAdminContent = document.getElementById('user-management-admin-content');
    const userManagementAdminNotice = document.getElementById('user-management-admin-notice');
    const navUserManagement = document.getElementById('nav-user-management');

    if (userRole === 'admin') {
        adminNotice.classList.add('hidden');
        adminContent.classList.remove('hidden');
        targetsAdminNotice.classList.add('hidden');
        targetsAdminContent.classList.remove('hidden');
        navTargets.classList.remove('hidden');
        userManagementAdminNotice.classList.add('hidden');
        userManagementAdminContent.classList.remove('hidden');
        navUserManagement.classList.remove('hidden');
    } else {
        adminNotice.classList.remove('hidden');
        adminContent.classList.add('hidden');
        targetsAdminNotice.classList.remove('hidden');
        targetsAdminContent.classList.add('hidden');
        navTargets.classList.add('hidden');
        userManagementAdminNotice.classList.remove('hidden');
        userManagementAdminContent.classList.add('hidden');
        navUserManagement.classList.add('hidden');
    }

    if (userRole === 'guest') {
        dataEntryPage.classList.add('opacity-50', 'pointer-events-none');
    } else {
        dataEntryPage.classList.remove('opacity-50', 'pointer-events-none');
    }
    filterAndRenderData();
}

// --- USER MANAGEMENT ---
async function fetchUsers() {
    if (userRole !== 'admin') return;
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        allUsers = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        renderUserManagementPage();
    } catch (error) {
        console.error("Error fetching users:", error);
        showToast("Gagal memuat daftar pengguna.", "error");
    }
}

function renderUserManagementPage() {
    const tableBody = document.getElementById('user-list-table');
    if (!tableBody) return;

    tableBody.innerHTML = allUsers.map(user => {
        const isCurrentUser = user.uid === currentUser.uid;
        const disabled = isCurrentUser ? 'disabled' : '';
        const note = isCurrentUser ? '<span class="text-xs text-gray-500 ml-2">(Anda)</span>' : '';

        return `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-3">${user.email} ${note}</td>
                <td class="p-3 font-semibold">${user.role.toUpperCase()}</td>
                <td class="p-3">
                    <select onchange="updateUserRole('${user.uid}', this.value)" ${disabled} class="p-2 border rounded-md bg-white">
                        <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>Staff</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </td>
            </tr>
        `;
    }).join('');
}

window.updateUserRole = async (uid, newRole) => {
    if (userRole !== 'admin') return showToast("Hanya admin yang bisa mengubah peran.", "error");
    if (uid === currentUser.uid) return showToast("Anda tidak bisa mengubah peran Anda sendiri.", "error");

    const userDocRef = doc(db, "users", uid);
    try {
        await updateDoc(userDocRef, { role: newRole });
        showToast("Peran pengguna berhasil diperbarui.", "success");
        const userToUpdate = allUsers.find(u => u.uid === uid);
        if (userToUpdate) userToUpdate.role = newRole;
        renderUserManagementPage();
    } catch (error) {
        console.error("Error updating user role:", error);
        showToast("Gagal memperbarui peran pengguna.", "error");
    }
};


// --- DATA ENTRY FORM LOGIC ---
function updatePrice() {
    const type = document.getElementById('donation-type').value;
    if (type === 'cash') return; // Do nothing for cash donations

    const tier = document.getElementById('donation-tier').value;
    const quantity = parseInt(document.getElementById('quantity').value, 10) || 1;
    const discount = parseInt(document.getElementById('discount').value, 10) || 0;
    const priceDisplayInput = document.getElementById('price-display');

    const basePrice = (prices[type] && prices[type][tier]) ? prices[type][tier] : 0;
    
    const totalBeforeDiscount = basePrice * quantity;
    const finalPrice = totalBeforeDiscount - discount;
    
    currentRawPrice = finalPrice < 0 ? 0 : finalPrice;
    priceDisplayInput.value = currentRawPrice.toLocaleString('id-ID');
}

function handleDonationTypeChange() {
    const donationTypeSelect = document.getElementById('donation-type');
    const tierField = document.getElementById('tier-field');
    const quantityField = document.getElementById('quantity-field');
    const priceDisplayInput = document.getElementById('price-display');
    const discountField = document.getElementById('discount-field');
    const donationTierSelect = document.getElementById('donation-tier');
    const type = donationTypeSelect.value;
    
    // Reset fields
    donationTierSelect.innerHTML = '';
    priceDisplayInput.value = '';
    document.getElementById('discount').value = '';
    document.getElementById('quantity').value = '1';
    currentRawPrice = 0;

    const isCash = type === 'cash';
    
    // Toggle visibility
    tierField.classList.toggle('hidden', isCash || !type);
    discountField.classList.toggle('hidden', isCash || !type);
    quantityField.classList.toggle('hidden', isCash);
    
    // Handle price input state
    priceDisplayInput.readOnly = !isCash;
    priceDisplayInput.classList.toggle('bg-gray-200', !isCash);
    priceDisplayInput.classList.toggle('bg-white', isCash);
    priceDisplayInput.placeholder = isCash ? 'Masukkan jumlah donasi' : 'Harga akan terisi otomatis';

    if (!isCash && prices[type]) {
        Object.keys(prices[type]).forEach(tierName => {
            const option = document.createElement('option');
            option.value = tierName;
            option.textContent = tierName;
            donationTierSelect.appendChild(option);
        });
    }
    
    // Initial price calculation
    updatePrice();
}

// --- FORM SUBMISSION ---
async function handleFormSubmit(e) {
    e.preventDefault();
    if (!currentUser) return showToast("Anda harus masuk untuk mengirim data.", "error");

    const type = document.getElementById('donation-type').value;
    const notes = document.getElementById('notes').value;
    let totalValue, pricePerUnit, quantity, discount, tier;

    if (type === 'cash') {
        totalValue = parseInt(document.getElementById('price-display').value.replace(/[^0-9]/g, ''), 10) || 0;
        pricePerUnit = totalValue;
        quantity = 1;
        discount = 0;
        tier = null;
    } else {
        quantity = parseInt(document.getElementById('quantity').value, 10) || 1;
        discount = parseInt(document.getElementById('discount').value, 10) || 0;
        tier = document.getElementById('donation-tier').value;
        const basePrice = (prices[type] && prices[type][tier]) ? prices[type][tier] : 0;
        
        totalValue = (basePrice * quantity) - discount;
        pricePerUnit = quantity > 0 ? totalValue / quantity : 0;
    }

    if (!type || totalValue < 0) return showToast("Data tidak lengkap atau harga tidak valid.", "error");

    const newDonation = {
        donorName: document.getElementById('donor-name').value,
        source: document.getElementById('donation-source').value,
        type: type,
        tier: tier,
        price: pricePerUnit,
        quantity: quantity,
        discount: discount,
        notes: notes,
        totalValue: totalValue,
        createdAt: serverTimestamp(),
        createdBy: currentUser.email,
        status: type === 'cash' ? 'N/A' : 'unallocated',
    };

    try {
        const docRef = await addDoc(collection(db, 'donations'), newDonation);
        const displayId = `${type.toUpperCase().slice(0,4)}-${newDonation.donorName.slice(0,4).toUpperCase()}-${docRef.id.slice(-4)}`;
        await updateDoc(docRef, { displayId: displayId });

        showToast("Donasi berhasil ditambahkan!", "success");
        document.getElementById('donation-form').reset();
        handleDonationTypeChange();
        showPage('dashboard');
    } catch (error) {
        showToast(`Error: ${error.message}`, "error");
    }
}

async function handleTargetFormSubmit(e) {
    e.preventDefault();
    if (userRole !== 'admin') return showToast("Hanya admin yang bisa mengatur target.", "error");

    const newTargets = {
        goat: parseInt(document.getElementById('target-goat').value, 10) || 0,
        cow_whole: parseInt(document.getElementById('target-cow').value, 10) || 0,
        cow_share: parseInt(document.getElementById('target-cow-share').value, 10) || 0,
        cash: parseInt(document.getElementById('target-cash-input').value, 10) || 0
    };

    try {
        await setDoc(doc(db, "app_config", "targets"), newTargets);
        showToast("Target berhasil disimpan!", "success");
        await fetchTargets();
        filterAndRenderData();
    } catch (error) {
        showToast(`Error menyimpan target: ${error.message}`, "error");
    }
}

// --- DATA FETCHING & RENDERING ---
async function fetchTargets() {
    try {
        const docRef = doc(db, "app_config", "targets");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            targets = docSnap.data();
            document.getElementById('target-goat').value = targets.goat || 0;
            document.getElementById('target-cow').value = targets.cow_whole || 0;
            document.getElementById('target-cow-share').value = targets.cow_share || 0;
            document.getElementById('target-cash-input').value = targets.cash || 0;
        } else {
            targets = { goat: 0, cow_whole: 0, cow_share: 0, cash: 0 };
        }
    } catch (error) {
        console.error("Error fetching targets:", error);
    }
}

function attachFirestoreListener() {
    if (unsubscribe) unsubscribe(); 

    fetchTargets();

    unsubscribe = onSnapshot(query(collection(db, 'donations')), (snapshot) => {
        allDonations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        filterAndRenderData();
    });
}

function filterAndRenderData() {
    if (!currentUser) return clearAllDataUI();
    
    const stockSearchTerm = document.getElementById('stock-search-input').value.toLowerCase();
    
    const filteredDonations = allDonations.filter(don => {
         return !stockSearchTerm || 
               (don.donorName && don.donorName.toLowerCase().includes(stockSearchTerm)) ||
               (don.displayId && don.displayId.toLowerCase().includes(stockSearchTerm)) ||
               (don.tier && don.tier.toLowerCase().includes(stockSearchTerm)) ||
               (don.location && don.location.toLowerCase().includes(stockSearchTerm)) ||
               (don.source && don.source.toLowerCase().includes(stockSearchTerm));
    });

    const totals = { goat: {qty:0, value:0}, cow_whole: {qty:0, value:0}, cow_share: {qty:0, value:0}, cash: {qty:0, value:0} };
    const rekapData = {};

    allDonations.forEach(data => {
        if (totals[data.type]) {
            totals[data.type].qty += data.quantity;
            totals[data.type].value += data.totalValue;
        }
        if (data.createdAt) {
            const date = new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0];
            if (!rekapData[date]) rekapData[date] = { goat: {qty:0, value:0}, cow_whole: {qty:0, value:0}, cow_share: {qty:0, value:0}, cash: {qty:0, value:0} };
            if (rekapData[date][data.type]) {
                rekapData[date][data.type].qty += data.quantity;
                rekapData[date][data.type].value += data.totalValue;
            }
        }
    });

    const unallocatedStock = filteredDonations.filter(d => d.status === 'unallocated');
    const allocatedStock = filteredDonations.filter(d => d.status === 'allocated');
    const cashDonations = filteredDonations.filter(d => d.type === 'cash');

    renderDashboard(totals);
    renderRecentDonations(allDonations);
    renderStockPage(unallocatedStock, allocatedStock, cashDonations);
    renderAllocationPage(unallocatedStock, allocatedStock);
    renderRekapPage(rekapData);
}

function clearAllDataUI() {
    document.getElementById('total-goats-value').textContent = 'Rp 0';
    document.getElementById('total-goats-qty').textContent = '0 ekor';
    document.getElementById('total-whole-cows-value').textContent = 'Rp 0';
    document.getElementById('total-whole-cows-qty').textContent = '0 ekor';
    document.getElementById('total-cows-value').textContent = 'Rp 0';
    document.getElementById('total-cows-qty').textContent = '0 bagian';
    document.getElementById('total-cash').textContent = 'Rp 0';
    document.getElementById('recent-donations-table').innerHTML = `<tr><td colspan="7" class="text-center p-4">Silakan masuk untuk melihat data.</td></tr>`;
    document.getElementById('stock-table').innerHTML = `<tr><td colspan="7" class="text-center p-4">Silakan masuk untuk melihat data.</td></tr>`;
    document.getElementById('allocated-stock-table').innerHTML = `<tr><td colspan="8" class="text-center p-4">Silakan masuk untuk melihat data.</td></tr>`;
    document.getElementById('cash-donations-table').innerHTML = `<tr><td colspan="6" class="text-center p-4">Silakan masuk untuk melihat data.</td></tr>`;
    document.getElementById('rekap-table').innerHTML = `<tr><td colspan="8" class="text-center p-4">Silakan masuk untuk melihat data.</td></tr>`;
    document.getElementById('allocation-stock-list').innerHTML = '<p class="text-center p-4">Silakan masuk untuk melihat data.</p>';
}

function renderDashboard(totals) {
    const format = (val) => `Rp ${val.toLocaleString('id-ID')}`;
    document.getElementById('total-goats-value').textContent = format(totals.goat.value);
    document.getElementById('total-goats-qty').textContent = `${totals.goat.qty} ekor`;
    document.getElementById('total-whole-cows-value').textContent = format(totals.cow_whole.value);
    document.getElementById('total-whole-cows-qty').textContent = `${totals.cow_whole.qty} ekor`;
    document.getElementById('total-cows-value').textContent = format(totals.cow_share.value);
    document.getElementById('total-cows-qty').textContent = `${totals.cow_share.qty} bagian`;
    document.getElementById('total-cash').textContent = format(totals.cash.value);

    // Progress Bars
    const targetGoat = targets.goat || 0;
    const progressGoat = targetGoat > 0 ? (totals.goat.qty / targetGoat) * 100 : 0;
    document.getElementById('target-goat-qty').textContent = targetGoat.toLocaleString('id-ID');
    document.getElementById('progress-bar-goat').style.width = `${Math.min(progressGoat, 100)}%`;

    const targetCow = targets.cow_whole || 0;
    const progressCow = targetCow > 0 ? (totals.cow_whole.qty / targetCow) * 100 : 0;
    document.getElementById('target-cow-qty').textContent = targetCow.toLocaleString('id-ID');
    document.getElementById('progress-bar-cow').style.width = `${Math.min(progressCow, 100)}%`;

    const targetCowShare = targets.cow_share || 0;
    const progressCowShare = targetCowShare > 0 ? (totals.cow_share.qty / targetCowShare) * 100 : 0;
    document.getElementById('target-cow-share-qty').textContent = targetCowShare.toLocaleString('id-ID');
    document.getElementById('progress-bar-cow-share').style.width = `${Math.min(progressCowShare, 100)}%`;

    const targetCash = targets.cash || 0;
    const progressCash = targetCash > 0 ? (totals.cash.value / targetCash) * 100 : 0;
    document.getElementById('target-cash-value').textContent = targetCash.toLocaleString('id-ID');
    document.getElementById('progress-bar-cash').style.width = `${Math.min(progressCash, 100)}%`;
}

function renderRecentDonations(donations) {
    const tableBody = document.getElementById('recent-donations-table');
    donations.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    tableBody.innerHTML = donations.slice(0, 10).map(don => {
        const actions = userRole === 'admin' ? `<td class="p-3 text-center"><button onclick="openEditModal('${don.id}')" class="action-btn" title="Ubah"><i data-lucide="edit"></i></button><button onclick="openDeleteModal('${don.id}')" class="action-btn text-red-500 hover:text-red-700" title="Hapus"><i data-lucide="trash-2"></i></button></td>` : '<td></td>';
        return `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-3 font-mono text-xs">${don.displayId || 'N/A'}</td>
                <td class="p-3">${don.donorName}</td>
                <td class="p-3">${don.tier ? `${don.type.replace(/_/g, ' ')} (${don.tier})` : don.type.replace(/_/g, ' ')}</td>
                <td class="p-3 text-center">${don.quantity}</td>
                <td class="p-3 text-right">Rp ${don.totalValue.toLocaleString('id-ID')}</td>
                <td class="p-3">${don.source}</td>
                ${actions}
            </tr>`;
    }).join('');
    lucide.createIcons();
}

function renderStockPage(unallocated, allocated, cash) {
    const unallocatedBody = document.getElementById('stock-table');
    unallocatedBody.innerHTML = unallocated.map(item => {
        const actions = userRole === 'admin' ? `<td class="p-3 text-center"><button onclick="openEditModal('${item.id}')" class="action-btn" title="Ubah"><i data-lucide="edit"></i></button><button onclick="openDeleteModal('${item.id}')" class="action-btn text-red-500 hover:text-red-700" title="Hapus"><i data-lucide="trash-2"></i></button></td>` : '<td></td>';
        return `
        <tr class="border-b hover:bg-gray-50">
            <td class="p-3 font-mono text-xs">${item.displayId}</td>
            <td class="p-3">${item.donorName}</td>
            <td class="p-3">${item.type.replace(/_/g, ' ')} (${item.quantity})</td>
            <td class="p-3">${item.tier}</td>
            <td class="p-3">${new Date((item.createdAt?.seconds || 0) * 1000).toLocaleDateString()}</td>
            <td class="p-3">${item.source}</td>
            ${actions}
        </tr>`;
    }).join('');
    if (unallocated.length === 0) unallocatedBody.innerHTML = '<tr><td colspan="7" class="text-center p-4">Tidak ada stok.</td></tr>';

    const allocatedBody = document.getElementById('allocated-stock-table');
    allocatedBody.innerHTML = allocated.map(item => {
        const actions = userRole === 'admin' ? `<td class="p-3 text-center"><button onclick="openEditModal('${item.id}')" class="action-btn" title="Ubah"><i data-lucide="edit"></i></button><button onclick="openDeleteModal('${item.id}')" class="action-btn text-red-500 hover:text-red-700" title="Hapus"><i data-lucide="trash-2"></i></button></td>` : '<td></td>';
        return `
         <tr class="border-b hover:bg-gray-50">
            <td class="p-3 font-mono text-xs">${item.displayId}</td>
            <td class="p-3">${item.donorName}</td>
            <td class="p-3">${item.type.replace(/_/g, ' ')} (${item.quantity})</td>
            <td class="p-3">${item.tier}</td>
            <td class="p-3">${item.location}</td>
            <td class="p-3">${item.source}</td>
            <td class="p-3">${item.allocatedBy}</td>
            ${actions}
        </tr>`;
    }).join('');
    if (allocated.length === 0) allocatedBody.innerHTML = '<tr><td colspan="8" class="text-center p-4">Belum ada stok yang dialokasikan.</td></tr>';

    const cashBody = document.getElementById('cash-donations-table');
    cashBody.innerHTML = cash.map(item => {
        const actions = userRole === 'admin' ? `<td class="p-3 text-center"><button onclick="openEditModal('${item.id}')" class="action-btn" title="Ubah"><i data-lucide="edit"></i></button><button onclick="openDeleteModal('${item.id}')" class="action-btn text-red-500 hover:text-red-700" title="Hapus"><i data-lucide="trash-2"></i></button></td>` : '<td></td>';
        return `
        <tr class="border-b hover:bg-gray-50">
            <td class="p-3 font-mono text-xs">${item.displayId}</td>
            <td class="p-3">${item.donorName}</td>
            <td class="p-3">${new Date((item.createdAt?.seconds || 0) * 1000).toLocaleDateString()}</td>
            <td class="p-3">${item.source}</td>
            <td class="p-3 text-right">Rp ${item.totalValue.toLocaleString('id-ID')}</td>
            ${actions}
        </tr>`;
    }).join('');
    if (cash.length === 0) cashBody.innerHTML = '<tr><td colspan="6" class="text-center p-4">Tidak ada donasi tunai.</td></tr>';

    lucide.createIcons();
}


function renderAllocationPage(unallocated, allocated) {
    const list = document.getElementById('allocation-stock-list');
    list.innerHTML = unallocated.map(item => `
        <div class="p-2 border-b hover:bg-indigo-50 cursor-pointer" onclick="selectStockItem('${item.id}', '${item.displayId}')">
            <p class="font-semibold">${item.type.replace(/_/g, ' ')} (${item.tier}) - Jumlah: ${item.quantity}</p>
            <p class="text-sm text-gray-600 font-mono">${item.displayId}</p>
        </div>
    `).join('');
    if (unallocated.length === 0) list.innerHTML = '<p class="text-center p-4">Tidak ada stok.</p>';
    
    const historyTable = document.getElementById('allocation-history-table');
    historyTable.innerHTML = allocated.map(item => `
         <tr class="border-b hover:bg-gray-50">
            <td class="p-3 font-mono text-xs">${item.displayId}</td>
            <td class="p-3">${item.type.replace(/_/g, ' ')} (${item.tier})</td>
            <td class="p-3">${item.location}</td>
            <td class="p-3">${item.allocatedBy}</td>
        </tr>`).join('');
    if (allocated.length === 0) historyTable.innerHTML = '<tr><td colspan="4" class="text-center p-4">Belum ada stok yang dialokasikan.</td></tr>';
}

function renderRekapPage(rekapData) {
    const rekapTable = document.getElementById('rekap-table');
    const searchTerm = document.getElementById('rekap-search-input').value.toLowerCase();
    
    const sortedDates = Object.keys(rekapData)
        .filter(date => date.includes(searchTerm))
        .sort((a,b) => new Date(b) - new Date(a));

    if (sortedDates.length === 0) {
        rekapTable.innerHTML = '<tr><td colspan="8" class="text-center p-4">Tidak ada data donasi untuk ditampilkan.</td></tr>';
        return;
    }
    rekapTable.innerHTML = sortedDates.map(date => {
        const data = rekapData[date];
        const formatVal = (val) => (val || 0).toLocaleString('id-ID');
        const formatQty = (qty) => (qty || 0);
        return `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-3 font-semibold">${date}</td>
                <td class="p-2 text-center">${formatQty(data.goat.qty)}</td>
                <td class="p-2 text-right">${formatVal(data.goat.value)}</td>
                <td class="p-2 text-center">${formatQty(data.cow_whole.qty)}</td>
                <td class="p-2 text-right">${formatVal(data.cow_whole.value)}</td>
                <td class="p-2 text-center">${formatQty(data.cow_share.qty)}</td>
                <td class="p-2 text-right">${formatVal(data.cow_share.value)}</td>
                <td class="p-2 text-right">${formatVal(data.cash.value)}</td>
            </tr>`;
    }).join('');
}

// --- DATA EXPORT ---
function exportData(page, format) {
    let data;
    let headers;
    let filename;
    
    const stockSearchTerm = document.getElementById('stock-search-input').value.toLowerCase();
    const filteredData = allDonations.filter(don => {
         return !stockSearchTerm || 
           (don.donorName && don.donorName.toLowerCase().includes(stockSearchTerm)) ||
           (don.displayId && don.displayId.toLowerCase().includes(stockSearchTerm)) ||
           (don.tier && don.tier.toLowerCase().includes(stockSearchTerm)) ||
           (don.location && don.location.toLowerCase().includes(stockSearchTerm)) ||
           (don.source && don.source.toLowerCase().includes(stockSearchTerm));
    });

    if (page === 'stock') {
        headers = ["ID Donasi", "Donatur", "Jenis", "Tipe", "Jumlah", "Harga Satuan", "Diskon", "Total Nilai", "Tanggal Masuk", "Sumber", "Status", "Lokasi", "Dialokasikan Oleh", "Catatan"];
        data = filteredData.map(item => [
            item.displayId || '',
            item.donorName || '',
            item.type.replace(/_/g, ' ') || '',
            item.tier || (item.type === 'cash' ? 'Tunai' : ''),
            item.quantity || 0,
            item.price || 0,
            item.discount || 0,
            item.totalValue || 0,
            item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleDateString() : '',
            item.source || '',
            item.status || '',
            item.location || '',
            item.allocatedBy || '',
            item.notes || ''
        ]);
        filename = `Laporan_Data_Dan_Stok_KMP_${new Date().toISOString().split('T')[0]}`;
    } else if (page === 'rekap') {
        const rekapData = {};
        allDonations.forEach(data => {
            if (data.createdAt) {
                const date = new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0];
                if (!rekapData[date]) rekapData[date] = { goat_qty:0, goat_val:0, cow_whole_qty:0, cow_whole_val:0, cow_share_qty:0, cow_share_val:0, cash_val:0 };
                if (data.type === 'goat') { rekapData[date].goat_qty += data.quantity; rekapData[date].goat_val += data.totalValue; }
                if (data.type === 'cow_whole') { rekapData[date].cow_whole_qty += data.quantity; rekapData[date].cow_whole_val += data.totalValue; }
                if (data.type === 'cow_share') { rekapData[date].cow_share_qty += data.quantity; rekapData[date].cow_share_val += data.totalValue; }
                if (data.type === 'cash') { rekapData[date].cash_val += data.totalValue; }
            }
        });
        
        headers = ["Tanggal", "Kambing (Jumlah)", "Kambing (Nilai)", "Sapi Utuh (Jumlah)", "Sapi Utuh (Nilai)", "1/7 Sapi (Jumlah)", "1/7 Sapi (Nilai)", "Donasi Tunai (Nilai)"];
        const searchTerm = document.getElementById('rekap-search-input').value.toLowerCase();
        data = Object.keys(rekapData)
            .filter(date => date.includes(searchTerm))
            .sort((a,b) => new Date(b) - new Date(a))
            .map(date => {
                const dayData = rekapData[date];
                return [date, dayData.goat_qty, dayData.goat_val, dayData.cow_whole_qty, dayData.cow_whole_val, dayData.cow_share_qty, dayData.cow_share_val, dayData.cash_val];
            });
        filename = `Rekap_Harian_KMP_${new Date().toISOString().split('T')[0]}`;
    }

    if (format === 'csv') {
        exportToCsv(filename, headers, data);
    } else if (format === 'xlsx') {
        exportToXlsx(filename, headers, data);
    }
}

function exportToCsv(filename, headers, data) {
    const csvContent = [
        headers.join(','),
        ...data.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${filename}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function exportToXlsx(filename, headers, data) {
    const ws_data = [headers, ...data];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    XLSX.writeFile(wb, `${filename}.xlsx`);
}


// --- ADMIN TOOLS ---
window.openEditModal = async (docId) => {
    if (userRole !== 'admin') return;
    
    const docRef = doc(db, "donations", docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('edit-doc-id').value = docId;
        document.getElementById('edit-donor-name').value = data.donorName;
        
        const sourceSelect = document.getElementById('edit-donation-source');
        sourceSelect.innerHTML = sources.map(s => `<option value="${s}" ${s === data.source ? 'selected' : ''}>${s}</option>`).join('');
        
        const isCash = data.type === 'cash';
        document.getElementById('edit-tier-field').style.display = isCash ? 'none' : 'block';
        document.getElementById('edit-quantity-field').style.display = isCash ? 'none' : 'block';
        document.getElementById('edit-price-field').style.display = isCash ? 'block' : 'none';
        document.getElementById('edit-location-field').style.display = data.status === 'allocated' ? 'block' : 'none';

        if(isCash) {
            document.getElementById('edit-price').value = data.totalValue;
        } else {
            const tierSelect = document.getElementById('edit-donation-tier');
            tierSelect.innerHTML = Object.keys(prices[data.type]).map(t => `<option value="${t}" ${t === data.tier ? 'selected' : ''}>${t}</option>`).join('');
            document.getElementById('edit-quantity').value = data.quantity;
            if (data.location) {
                document.getElementById('edit-location').value = data.location;
            }
        }
        
        openModal('editModal');
    } else {
        showToast("Dokumen tidak ditemukan!", "error");
    }
};

async function handleEditSubmit(e) {
    e.preventDefault();
    const docId = document.getElementById('edit-doc-id').value;
    const docRef = doc(db, "donations", docId);
    const originalDoc = await getDoc(docRef);
    const originalData = originalDoc.data();

    const updatedData = {
        donorName: document.getElementById('edit-donor-name').value,
        source: document.getElementById('edit-donation-source').value,
    };

    if (originalData.type === 'cash') {
        const newPrice = parseFloat(document.getElementById('edit-price').value);
        updatedData.price = newPrice;
        updatedData.totalValue = newPrice;
    } else {
        const newQuantity = parseInt(document.getElementById('edit-quantity').value, 10);
        const newTier = document.getElementById('edit-donation-tier').value;
        const newPrice = prices[originalData.type][newTier];

        updatedData.quantity = newQuantity;
        updatedData.tier = newTier;
        updatedData.price = newPrice;
        updatedData.totalValue = newPrice * newQuantity;
        
        if (originalData.status === 'allocated') {
            updatedData.location = document.getElementById('edit-location').value;
        }
    }

    await updateDoc(docRef, updatedData);
    
    closeModal('editModal');
    showToast("Donasi berhasil diperbarui!", "success");
}

window.openDeleteModal = (docId) => {
    if (userRole !== 'admin') return;
    const modalContainer = document.getElementById('confirmDeleteModal');
    modalContainer.innerHTML = `
        <div class="modal-content">
            <h3 class="text-lg font-bold text-center">Konfirmasi Hapus</h3>
            <p class="text-center my-4">Apakah Anda yakin ingin menghapus donasi ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div class="flex justify-center space-x-4">
                <button id="confirm-delete-btn" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">Ya, Hapus</button>
                <button type="button" onclick="closeModal('confirmDeleteModal')" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">Batal</button>
            </div>
        </div>`;
    
    document.getElementById('confirm-delete-btn').onclick = () => deleteDonation(docId);
    openModal('confirmDeleteModal');
};

async function deleteDonation(docId) {
    if (userRole !== 'admin') return;
    await deleteDoc(doc(db, "donations", docId));
    showToast("Donasi berhasil dihapus.", "success");
    closeModal('confirmDeleteModal');
}

// --- ALLOCATION LOGIC ---
window.selectStockItem = (docId, displayId) => {
    document.getElementById('real-doc-id').value = docId;
    document.getElementById('display-id-field').value = displayId;
};

document.getElementById('allocation-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (userRole !== 'admin') return showToast("Anda tidak diizinkan.", "error");
    const docId = document.getElementById('real-doc-id').value;
    const location = document.getElementById('location').value;
    if (!docId || !location) return showToast("Silakan pilih stok dan masukkan lokasi.", "error");
    
    try {
        await updateDoc(doc(db, "donations", docId), {
            status: 'allocated',
            location: location,
            allocatedBy: currentUser.email,
            allocatedAt: serverTimestamp()
        });
        showToast("Stok berhasil dialokasikan!", "success");
        e.target.reset();
        document.getElementById('display-id-field').value = '';
        document.getElementById('real-doc-id').value = '';
    } catch (error) {
        showToast(`Gagal mengalokasikan stok: ${error.message}`, "error");
    }
});

// --- UTILITY FUNCTIONS ---
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    toast.className = 'fixed bottom-5 right-5 text-white py-2 px-4 rounded-lg shadow-lg';
    toast.classList.remove('hidden');
    toast.classList.add(type === 'success' ? 'bg-green-500' : 'bg-red-500');
    toastMessage.textContent = message;
    setTimeout(() => { toast.classList.add('hidden'); }, 3000);
}
