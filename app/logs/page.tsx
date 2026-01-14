'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { format, subMonths, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ChatLog {
  id: string;
  created_at: string;
  data: {
    messages?: Array<{
      type: 'avatar' | 'user';
      message: string;
      timestamp: string;
    }>;
    session_id?: string;
    last_updated?: string;
    [key: string]: any;
  };
}

interface DailyStats {
  date: string;
  count: number;
}

export default function LogsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dati' | 'conversazioni'>('dati');
  const [selectedLog, setSelectedLog] = useState<ChatLog | null>(null);
  
  // Date range state (default: last 3 months)
  const [startDate, setStartDate] = useState<string>(
    format(subMonths(new Date(), 3), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );

  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchLogs();
    }
  }, [startDate, endDate, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      calculateDailyStats();
    }
  }, [logs, isAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const response = await fetch('/api/logs/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        setIsAuthenticated(true);
        setPassword('');
      } else {
        setAuthError(data.error || 'Password non corretta');
      }
    } catch (error) {
      setAuthError('Errore di connessione');
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const startDateTime = startOfDay(new Date(startDate)).toISOString();
      const endDateTime = endOfDay(new Date(endDate)).toISOString();

      const { data, error } = await supabase
        .from('chat_logs')
        .select('*')
        .gte('created_at', startDateTime)
        .lte('created_at', endDateTime)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
      if (data && data.length > 0 && !selectedLog) {
        setSelectedLog(data[0]);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDailyStats = () => {
    if (logs.length === 0) {
      setDailyStats([]);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const allDays = eachDayOfInterval({ start, end });

    const countsByDate: { [key: string]: number } = {};
    
    logs.forEach((log) => {
      const dateStr = format(new Date(log.created_at), 'yyyy-MM-dd');
      countsByDate[dateStr] = (countsByDate[dateStr] || 0) + 1;
    });

    const stats = allDays.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      return {
        date: format(day, 'dd/MM'),
        count: countsByDate[dateStr] || 0,
      };
    });

    setDailyStats(stats);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd/MM/yyyy HH:mm', { locale: it });
  };

  const getConversationPreview = (log: ChatLog) => {
    const messages = log.data?.messages || [];
    if (messages.length === 0) return 'Nessun messaggio';
    const firstUserMessage = messages.find((m) => m.type === 'user');
    return firstUserMessage?.message?.substring(0, 50) || 'Conversazione';
  };

  const downloadCSV = () => {
    if (logs.length === 0) {
      alert('Nessun dato da esportare');
      return;
    }

    // Prepara i dati CSV
    const csvRows = [];
    
    // Header
    csvRows.push(['ID Conversazione', 'Data Creazione', 'Session ID', 'Tipo Messaggio', 'Messaggio', 'Timestamp Messaggio'].join(','));
    
    // Dati
    logs.forEach((log) => {
      const messages = log.data?.messages || [];
      if (messages.length === 0) {
        // Se non ci sono messaggi, aggiungi una riga vuota per la conversazione
        csvRows.push([
          `"${log.id}"`,
          `"${formatDate(log.created_at)}"`,
          `"${log.data?.session_id || 'N/A'}"`,
          '',
          '',
          ''
        ].join(','));
      } else {
        messages.forEach((msg) => {
          csvRows.push([
            `"${log.id}"`,
            `"${formatDate(log.created_at)}"`,
            `"${log.data?.session_id || 'N/A'}"`,
            `"${msg.type}"`,
            `"${msg.message.replace(/"/g, '""')}"`, // Escape delle virgolette
            `"${msg.timestamp ? formatDate(msg.timestamp) : 'N/A'}"`
          ].join(','));
        });
      }
    });

    // Crea il file e scarica
    const csvContent = csvRows.join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // UTF-8 BOM per Excel
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `conversazioni_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Accesso Log Conversazioni
          </h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Inserisci la password"
                required
                disabled={authLoading}
              />
            </div>
            {authError && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                {authError}
              </div>
            )}
            <button
              type="submit"
              disabled={authLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {authLoading ? 'Verifica...' : 'Accedi'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Date Range Selector */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-end justify-between">
            <div className="flex gap-3 items-end">
              <div className="w-fit">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Data Inizio
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-fit px-2 py-1 text-sm text-gray-700 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="w-fit">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Data Fine
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-fit px-2 py-1 text-sm text-gray-700 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-3 items-end">
              <button
                onClick={downloadCSV}
                disabled={logs.length === 0}
                className="px-4 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Scarica CSV
              </button>
              <button
                onClick={() => setIsAuthenticated(false)}
                className="px-4 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded transition-colors"
              >
                Esci
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('dati')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'dati'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Dati
              </button>
              <button
                onClick={() => setActiveTab('conversazioni')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'conversazioni'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Conversazioni
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Caricamento...</p>
          </div>
        ) : (
          <>
            {/* Dati Tab */}
            {activeTab === 'dati' && (
              <div className="space-y-6">
                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">
                      Totale Conversazioni
                    </h3>
                    <p className="text-3xl font-bold text-blue-600">{logs.length}</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">
                      Media Giornaliera
                    </h3>
                    <p className="text-3xl font-bold text-green-600">
                      {dailyStats.length > 0
                        ? (logs.length / dailyStats.length).toFixed(1)
                        : '0'}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">
                      Periodo
                    </h3>
                    <p className="text-lg font-bold text-purple-600">
                      {dailyStats.length} giorni
                    </p>
                  </div>
                </div>

                {/* Chart */}
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Conversazioni per Giorno
                  </h3>
                  {dailyStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 12 }}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="count"
                          stroke="#2563eb"
                          strokeWidth={2}
                          name="Conversazioni"
                          dot={{ fill: '#2563eb', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-500 text-center py-12">
                      Nessun dato disponibile per il periodo selezionato
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Conversazioni Tab */}
            {activeTab === 'conversazioni' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left: List of Conversations */}
                <div className="md:col-span-1">
                  <div className="bg-white rounded-lg shadow-md">
                    {logs.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">
                        Nessuna conversazione trovata
                      </div>
                    ) : (
                      <div className="divide-y">
                        {logs.map((log) => (
                          <button
                            key={log.id}
                            onClick={() => setSelectedLog(log)}
                            className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                              selectedLog?.id === log.id ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="text-sm text-gray-500 mb-1">
                              {formatDate(log.created_at)}
                            </div>
                            <div className="text-sm text-gray-900 line-clamp-2">
                              {getConversationPreview(log)}...
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Conversation Details */}
                <div className="md:col-span-2">
                  <div className="bg-white rounded-lg shadow-md">
                    <div className="p-6">
                      {selectedLog ? (
                        <div>
                          <div className="mb-6 pb-4 border-b">
                            <h3 className="text-lg font-semibold text-gray-900">
                              Conversazione
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                              {formatDate(selectedLog.created_at)}
                            </p>
                          </div>

                          {selectedLog.data?.messages && selectedLog.data.messages.length > 0 ? (
                            <div className="space-y-4">
                              {selectedLog.data.messages.map((msg, index) => (
                                <div
                                  key={index}
                                  className={`flex ${
                                    msg.type === 'user' ? 'justify-end' : 'justify-start'
                                  }`}
                                >
                                  <div
                                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                                      msg.type === 'user'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 text-gray-900'
                                    }`}
                                  >
                                    <div className="text-xs font-semibold mb-1 opacity-80">
                                      {msg.type === 'user' ? 'Utente' : 'Avatar'}
                                    </div>
                                    <div className="text-sm whitespace-pre-wrap">
                                      {msg.message}
                                    </div>
                                    {msg.timestamp && (
                                      <div className="text-xs mt-1 opacity-70">
                                        {format(new Date(msg.timestamp), 'HH:mm')}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center text-gray-500 py-12">
                              <p>Nessun messaggio in questa conversazione</p>
                              <div className="mt-4 text-xs text-gray-400">
                                <details>
                                  <summary className="cursor-pointer">Dati grezzi</summary>
                                  <pre className="mt-2 text-left bg-gray-100 p-4 rounded overflow-auto">
                                    {JSON.stringify(selectedLog.data, null, 2)}
                                  </pre>
                                </details>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 py-12">
                          Seleziona una conversazione dalla lista
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
