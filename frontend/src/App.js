import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Building2, Calendar, MapPin, DollarSign, Eye, BarChart3, Save, X, User, LogOut, LogIn, UserPlus } from 'lucide-react';

const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3001/api' : '/api';

const JobTracker = () => {
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState('list');
  const [selectedJob, setSelectedJob] = useState(null);
  const [filters, setFilters] = useState({ status: '', company: '', page: 1 });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [authView, setAuthView] = useState('login'); // 'login' or 'register'

  const statusColors = {
    applied: 'bg-blue-100 text-blue-800',
    interview: 'bg-yellow-100 text-yellow-800',
    offer: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    withdrawn: 'bg-gray-100 text-gray-800'
  };

  const statusOptions = [
    { value: 'applied', label: 'Applied' },
    { value: 'interview', label: 'Interview' },
    { value: 'offer', label: 'Offer' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'withdrawn', label: 'Withdrawn' }
  ];

  const [formData, setFormData] = useState({
    company_name: '',
    job_title: '',
    job_url: '',
    location: '',
    salary_range: '',
    application_date: new Date().toISOString().split('T')[0],
    status: 'applied',
    description: '',
    requirements: '',
    notes: '',
    contact_person: '',
    contact_email: '',
    follow_up_date: ''
  });

  const [authData, setAuthData] = useState({
    username: '',
    email: '',
    password: ''
  });

  // Check for existing token on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      verifyToken(token);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchJobs();
    }
  }, [filters, user]);

  useEffect(() => {
    if (currentView === 'stats' && user) {
      fetchStats();
    }
  }, [currentView, user]);

  const verifyToken = async (token) => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('token');
    }
  };

  const makeAuthenticatedRequest = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = authView === 'login' ? '/auth/login' : '/auth/register';
      const body = authView === 'login' 
        ? { email: authData.email, password: authData.password }
        : authData;

      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setAuthData({ username: '', email: '', password: '' });
      } else {
        alert(data.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Auth error:', error);
      alert('Network error during authentication');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setJobs([]);
    setStats(null);
    setCurrentView('list');
  };

  const fetchJobs = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.company) queryParams.append('company', filters.company);
      queryParams.append('page', filters.page);
      queryParams.append('limit', '10');

      const response = await makeAuthenticatedRequest(`${API_BASE}/jobs?${queryParams}`);
      const data = await response.json();
      
      if (response.ok) {
        setJobs(data.jobs);
        setPagination(data.pagination);
      } else {
        console.error('Error fetching jobs:', data.error);
      }
    } catch (error) {
      console.error('Network error:', error);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    if (!user) return;
    
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE}/stats`);
      const data = await response.json();
      
      if (response.ok) {
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = currentView === 'edit' 
        ? `${API_BASE}/jobs/${selectedJob.id}`
        : `${API_BASE}/jobs`;
      
      const method = currentView === 'edit' ? 'PUT' : 'POST';
      
      const response = await makeAuthenticatedRequest(url, {
        method,
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setCurrentView('list');
        fetchJobs();
        resetForm();
      } else {
        const data = await response.json();
        console.error('Error:', data.error);
      }
    } catch (error) {
      console.error('Network error:', error);
    }
    setLoading(false);
  };

  const handleDelete = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job application?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await makeAuthenticatedRequest(`${API_BASE}/jobs/${jobId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchJobs();
      } else {
        const data = await response.json();
        console.error('Error deleting job:', data.error);
        alert('Error deleting job application');
      }
    } catch (error) {
      console.error('Network error:', error);
      alert('Network error while deleting');
    }
    setLoading(false);
  };

  const handleEdit = (job) => {
    setSelectedJob(job);
    setFormData({
      company_name: job.company_name || '',
      job_title: job.job_title || '',
      job_url: job.job_url || '',
      location: job.location || '',
      salary_range: job.salary_range || '',
      application_date: job.application_date ? new Date(job.application_date).toISOString().split('T')[0] : '',
      status: job.status || 'applied',
      description: job.description || '',
      requirements: job.requirements || '',
      notes: job.notes || '',
      contact_person: job.contact_person || '',
      contact_email: job.contact_email || '',
      follow_up_date: job.follow_up_date ? new Date(job.follow_up_date).toISOString().split('T')[0] : ''
    });
    setCurrentView('edit');
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      job_title: '',
      job_url: '',
      location: '',
      salary_range: '',
      application_date: new Date().toISOString().split('T')[0],
      status: 'applied',
      description: '',
      requirements: '',
      notes: '',
      contact_person: '',
      contact_email: '',
      follow_up_date: ''
    });
    setSelectedJob(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString();
  };

  // If user is not authenticated, show login/register form
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Job Application Tracker</h1>
            <p className="text-gray-600 mt-2">Track your job applications securely</p>
          </div>

          <div className="flex mb-6">
            <button
              onClick={() => setAuthView('login')}
              className={`flex-1 py-2 px-4 text-center rounded-l-lg ${authView === 'login' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              <LogIn className="inline mr-2" size={16} />
              Login
            </button>
            <button
              onClick={() => setAuthView('register')}
              className={`flex-1 py-2 px-4 text-center rounded-r-lg ${authView === 'register' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              <UserPlus className="inline mr-2" size={16} />
              Register
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authView === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={authData.username}
                  onChange={(e) => setAuthData({...authData, username: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter username"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={authData.email}
                onChange={(e) => setAuthData({...authData, email: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                required
                value={authData.password}
                onChange={(e) => setAuthData({...authData, password: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter password"
                minLength="6"
              />
              {authView === 'register' && (
                <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : (authView === 'login' ? 'Login' : 'Create Account')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Main application UI (shown when user is authenticated)
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Job Application Tracker</h1>
            <p className="text-gray-600 mt-2">Welcome back, {user.username}!</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setCurrentView('list')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${currentView === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            <Eye size={16} />
            Job List
          </button>
          <button
            onClick={() => { setCurrentView('add'); resetForm(); }}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${currentView === 'add' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            <Plus size={16} />
            Add Job
          </button>
          <button
            onClick={() => setCurrentView('stats')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${currentView === 'stats' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            <BarChart3 size={16} />
            Statistics
          </button>
        </div>

        {currentView === 'list' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading jobs...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">No job applications found. Start by adding your first application!</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {jobs.map((job) => (
                  <div key={job.id} className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{job.job_title}</h3>
                        <div className="flex items-center gap-2 text-gray-600 mt-1">
                          <Building2 size={16} />
                          <span>{job.company_name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[job.status]}`}>
                          {statusOptions.find(s => s.value === job.status)?.label}
                        </span>
                        <button
                          onClick={() => handleEdit(job)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit job"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(job.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete job"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                      {job.location && (
                        <div className="flex items-center gap-1">
                          <MapPin size={14} />
                          <span>{job.location}</span>
                        </div>
                      )}
                      {job.salary_range && (
                        <div className="flex items-center gap-1">
                          <DollarSign size={14} />
                          <span>{job.salary_range}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>Applied: {formatDate(job.application_date)}</span>
                      </div>
                    </div>

                    {job.notes && (
                      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                        <strong>Notes:</strong> {job.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentView === 'stats' && stats && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">Application Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.applied}</div>
                <div className="text-sm text-gray-600">Applied</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{stats.interview}</div>
                <div className="text-sm text-gray-600">Interview</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.offer}</div>
                <div className="text-sm text-gray-600">Offers</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
                <div className="text-sm text-gray-600">Rejected</div>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{stats.withdrawn}</div>
                <div className="text-sm text-gray-600">Withdrawn</div>
              </div>
            </div>
          </div>
        )}

        {(currentView === 'add' || currentView === 'edit') && (
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {currentView === 'edit' ? 'Edit Job Application' : 'Add New Job Application'}
              </h2>
              <button
                onClick={() => setCurrentView('list')}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.company_name}
                    onChange={(e) => setFormData({...formData, company_name: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Job Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.job_title}
                    onChange={(e) => setFormData({...formData, job_title: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Job URL
                  </label>
                  <input
                    type="url"
                    value={formData.job_url}
                    onChange={(e) => setFormData({...formData, job_url: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Salary Range
                  </label>
                  <input
                    type="text"
                    value={formData.salary_range}
                    onChange={(e) => setFormData({...formData, salary_range: e.target.value})}
                    placeholder="e.g., $80k-100k"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Application Date
                  </label>
                  <input
                    type="date"
                    value={formData.application_date}
                    onChange={(e) => setFormData({...formData, application_date: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {statusOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Any notes about this application..."
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save size={16} />
                  {loading ? 'Saving...' : (currentView === 'edit' ? 'Update Job' : 'Add Job')}
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentView('list')}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobTracker;
