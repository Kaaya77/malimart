import React from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Switch } from '../../components/UI';
import { CheckCircle2, Download, Loader2, LogOut } from 'lucide-react';
import { useBuyerSettings } from './context';

export const SecurityTab = () => {
    const { confirmRequestAccountDeletion, connectedAccounts, handleConnectAccount, handleExportData, isExporting, loginHistory, preferences, setPreferences, togglePreference, updateUserProfile } = useBuyerSettings();
    return (
            <div className="space-y-6 animate-in fade-in">
              <Card>
                  <CardHeader>
                      <CardTitle>Notifications</CardTitle>
                      <CardDescription>Control how we contact you.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
                          <div>
                              <p className="font-medium text-sm text-foreground">Email Notifications</p>
                              <p className="text-xs text-muted-foreground">Order updates and promotions</p>
                          </div>
                          <Switch checked={preferences.emailNotifications} onChange={() => togglePreference('emailNotifications')} />
                      </div>
                      <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
                          <div>
                              <p className="font-medium text-sm text-foreground">SMS Updates</p>
                              <p className="text-xs text-muted-foreground">Delivery tracking and alerts</p>
                          </div>
                          <Switch checked={preferences.smsNotifications} onChange={() => togglePreference('smsNotifications')} />
                      </div>
                      <div className="flex items-center justify-between py-3">
                          <div>
                              <p className="font-medium text-sm text-foreground">Newsletter</p>
                              <p className="text-xs text-muted-foreground">Weekly deals and platform news</p>
                          </div>
                          <Switch checked={preferences.newsletter} onChange={() => togglePreference('newsletter')} />
                      </div>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle>Security</CardTitle>
                      <CardDescription>Protect your account.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
                          <div>
                              <p className="font-medium text-sm text-foreground">Two-Factor Authentication (2FA)</p>
                              <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
                          </div>
                          <Switch checked={preferences.twoFactorAuth} onChange={() => togglePreference('twoFactorAuth')} />
                      </div>
                      <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-white/5">
                          <div>
                              <p className="font-medium text-sm text-foreground">Public Profile</p>
                              <p className="text-xs text-muted-foreground">Allow others to see your reviews</p>
                          </div>
                          <Switch checked={preferences.profileVisibility} onChange={() => togglePreference('profileVisibility')} />
                      </div>
                      <div className="flex items-center justify-between py-3">
                          <div>
                              <p className="font-medium text-sm text-foreground">Opt-out of Analytics</p>
                              <p className="text-xs text-muted-foreground">Do not track my usage data</p>
                          </div>
                          <Switch checked={preferences.optOutAnalytics} onChange={() => togglePreference('optOutAnalytics')} />
                      </div>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle>Connected Accounts</CardTitle>
                      <CardDescription>Link social accounts for quicker login.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {['google', 'facebook'].map(provider => {
                              const account = connectedAccounts.find(a => a.provider === provider);
                              return (
                                  <div key={provider} className="flex items-center justify-between p-4 border border-foreground/10 rounded-xl bg-foreground/[0.03] ">
                                      <div className="flex items-center gap-3">
                                          <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${provider === 'google' ? 'bg-white' : 'bg-[#1877F2]'}`}>
                                              {provider === 'google' ? (
                                                  <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                                              ) : (
                                                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                              )}
                                          </div>
                                          <span className="font-medium text-sm text-foreground capitalize">{provider}</span>
                                      </div>
                                      {account ? (
                                          <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5"/> Connected</span>
                                      ) : (
                                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleConnectAccount(provider)}>Connect</Button>
                                      )}
                                  </div>
                              );
                          })}
                      </div>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle>Data & Account Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-foreground/[0.03]  rounded-xl">
                          <div>
                              <p className="font-medium text-sm text-foreground">Export Format</p>
                              <p className="text-xs text-muted-foreground">Preferred format for data exports</p>
                          </div>
                          <select 
                              className="h-9 bg-background border border-foreground/10 rounded-lg px-3 text-sm outline-none"
                              value={preferences.exportFormat}
                              onChange={(e) => {
                                  setPreferences({...preferences, exportFormat: e.target.value});
                                  updateUserProfile({ export_format: e.target.value as any });
                              }}
                          >
                              <option value="csv">CSV</option>
                              <option value="pdf">PDF</option>
                              <option value="json">JSON</option>
                          </select>
                      </div>

                      <div className="flex flex-col md:flex-row gap-4">
                          <Button variant="secondary" className="flex-1" onClick={handleExportData} disabled={isExporting}>
                              {isExporting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Exporting...</> : <><Download className="w-4 h-4 mr-2" /> Export Data</>}
                          </Button>
                          <Button variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:border-red-900/50" onClick={confirmRequestAccountDeletion}>
                              <LogOut className="w-4 h-4 mr-2" /> Delete Account
                          </Button>
                      </div>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle>Recent Logins</CardTitle>
                  </CardHeader>
                  <CardContent>
                      <div className="space-y-2">
                          {loginHistory.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No recent logins found.</p>
                          ) : (
                              loginHistory.map((login, idx) => (
                                  <div key={idx} className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-white/5 last:border-0 last:pb-0">
                                      <div>
                                          <p className="text-sm font-medium">{login.device_info || 'Unknown Device'}</p>
                                          <p className="text-xs text-muted-foreground">{login.ip_address || 'Unknown IP'}</p>
                                      </div>
                                      <p className="text-xs text-muted-foreground">{new Date(login.login_time).toLocaleString()}</p>
                                  </div>
                              ))
                          )}
                      </div>
                  </CardContent>
              </Card>
            </div>
    );
};
