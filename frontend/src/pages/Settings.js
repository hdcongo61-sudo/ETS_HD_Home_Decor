import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast, { Toaster } from 'react-hot-toast';

const TABS = [
  { key: 'categories', label: 'Catégories', endpoint: '/lookups/categories' },
  { key: 'containers', label: 'Conteneurs', endpoint: '/lookups/containers' },
  { key: 'warehouses', label: 'Entrepôts', endpoint: '/lookups/warehouses' },
  { key: 'suppliers', label: 'Fournisseurs', endpoint: '/lookups/suppliers' },
];

const sortByName = (items) =>
  [...items].sort((a, b) => (a?.name || '').localeCompare(b?.name || '', 'fr', { sensitivity: 'base' }));

const Settings = () => {
  const [activeTab, setActiveTab] = useState('categories');

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 lg:py-10">
      <Toaster position="top-right" />
      <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl tracking-tight mb-6">
        Paramètres
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 min-w-0 px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'suppliers' ? (
        <SupplierTab endpoint="/lookups/suppliers" />
      ) : (
        <LookupTab
          key={activeTab}
          endpoint={TABS.find((t) => t.key === activeTab).endpoint}
          label={TABS.find((t) => t.key === activeTab).label}
        />
      )}
    </div>
  );
};

/* ============================================================ */
/* Generic Lookup Tab (Categories, Containers, Warehouses)       */
/* ============================================================ */
const LookupTab = ({ endpoint, label }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(endpoint);
      setItems(data);
    } catch {
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setSubmitting(true);
      const { data } = await api.post(endpoint, { name: newName.trim() });
      setItems((prev) => sortByName([...prev, data]));
      setNewName('');
      toast.success('Ajouté');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    try {
      setSubmitting(true);
      const { data } = await api.put(`${endpoint}/${id}`, { name: editName.trim() });
      setItems((prev) => sortByName(prev.map((item) => (item._id === id ? data : item))));
      setEditingId(null);
      setEditName('');
      toast.success('Modifié');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet élément ?')) return;
    try {
      await api.delete(`${endpoint}/${id}`);
      setItems((prev) => prev.filter((item) => item._id !== id));
      toast.success('Supprimé');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Add form */}
      <form onSubmit={handleAdd} className="flex gap-3 p-4 border-b border-gray-100 bg-gray-50/50">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`Nouveau nom...`}
          className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={submitting || !newName.trim()}
          className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          Ajouter
        </button>
      </form>

      {/* List */}
      {items.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          Aucun élément. Ajoutez-en un ci-dessus.
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <div key={item._id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">
              {editingId === item._id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate(item._id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <button
                    onClick={() => handleUpdate(item._id)}
                    disabled={submitting}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-900 font-medium">{item.name}</span>
                  <button
                    onClick={() => { setEditingId(item._id); setEditName(item.name); }}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(item._id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-500">
        {items.length} élément{items.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

/* ============================================================ */
/* Supplier Tab (name + phone)                                   */
/* ============================================================ */
const SupplierTab = ({ endpoint }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(endpoint);
      setItems(data);
    } catch {
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setSubmitting(true);
      const { data } = await api.post(endpoint, { name: newName.trim(), phone: newPhone.trim() });
      setItems((prev) => sortByName([...prev, data]));
      setNewName('');
      setNewPhone('');
      toast.success('Fournisseur ajouté');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    try {
      setSubmitting(true);
      const { data } = await api.put(`${endpoint}/${id}`, { name: editName.trim(), phone: editPhone.trim() });
      setItems((prev) => sortByName(prev.map((item) => (item._id === id ? data : item))));
      setEditingId(null);
      setEditName('');
      setEditPhone('');
      toast.success('Modifié');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce fournisseur ?')) return;
    try {
      await api.delete(`${endpoint}/${id}`);
      setItems((prev) => prev.filter((item) => item._id !== id));
      toast.success('Supprimé');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Add form */}
      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gray-100 bg-gray-50/50">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nom du fournisseur"
          className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <input
          type="text"
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
          placeholder="Téléphone"
          className="sm:w-48 px-4 py-2.5 text-sm border border-gray-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={submitting || !newName.trim()}
          className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          Ajouter
        </button>
      </form>

      {/* List */}
      {items.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          Aucun fournisseur. Ajoutez-en un ci-dessus.
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {items.map((item) => (
            <div key={item._id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">
              {editingId === item._id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate(item._id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Téléphone"
                    className="w-36 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate(item._id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <button
                    onClick={() => handleUpdate(item._id)}
                    disabled={submitting}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    {item.phone && <div className="text-xs text-gray-500">{item.phone}</div>}
                  </div>
                  <button
                    onClick={() => { setEditingId(item._id); setEditName(item.name); setEditPhone(item.phone || ''); }}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(item._id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-500">
        {items.length} fournisseur{items.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

export default Settings;
