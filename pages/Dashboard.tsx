import React from 'react';
import { Card, Badge } from '../components/UIComponents';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import { ArrowRight, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { useGlobalData } from '../App';

export const Dashboard: React.FC = () => {
  const { history, metrics, isLoading } = useGlobalData();
  const recentItems = history.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-l-4 border-l-primary">
          <div className="text-text-secondary text-sm font-medium uppercase">총 분석 건수</div>
          <div className="text-3xl font-bold text-text-primary mt-1">{metrics.totalAnalyses}</div>
          <div className="text-xs text-text-secondary mt-1">전체 기간</div>
        </Card>
        <Card className="border-l-4 border-l-risk-high">
          <div className="text-risk-high text-sm font-medium uppercase flex items-center gap-2">
            <AlertCircle size={16} /> 고위험
          </div>
          <div className="text-3xl font-bold text-text-primary mt-1">{metrics.highRiskCount}</div>
          <div className="text-xs text-text-secondary mt-1">조치 필요</div>
        </Card>
        <Card className="border-l-4 border-l-risk-medium">
          <div className="text-risk-medium text-sm font-medium uppercase flex items-center gap-2">
            <AlertTriangle size={16} /> 중위험
          </div>
          <div className="text-3xl font-bold text-text-primary mt-1">{metrics.mediumRiskCount}</div>
          <div className="text-xs text-text-secondary mt-1">검토 필요</div>
        </Card>
        <Card className="border-l-4 border-l-risk-low">
          <div className="text-risk-low text-sm font-medium uppercase flex items-center gap-2">
            <CheckCircle size={16} /> 저위험
          </div>
          <div className="text-3xl font-bold text-text-primary mt-1">{metrics.lowRiskCount}</div>
          <div className="text-xs text-text-secondary mt-1">규정 준수</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Analyses */}
        <div className="lg:col-span-2">
          <Card title="최근 분석 내역" className="h-full">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-text-secondary font-medium">
                  <tr>
                    <th className="px-4 py-3">날짜</th>
                    <th className="px-4 py-3">광고명</th>
                    <th className="px-4 py-3">점수</th>
                    <th className="px-4 py-3">위험도</th>
                    <th className="px-4 py-3 text-right">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-text-secondary">데이터를 불러오는 중...</td>
                    </tr>
                  )}
                  {!isLoading && recentItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-text-secondary">최근 분석 내역이 없습니다.</td>
                    </tr>
                  )}
                  {!isLoading && recentItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-text-secondary">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-text-primary">{item.adName}</td>
                      <td className="px-4 py-3">
                        <span className={item.passScore > 70 ? 'text-risk-low font-bold' : 'text-risk-high font-bold'}>
                          {item.passScore}/100
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge label={item.riskLevel === 'high' ? '고위험' : item.riskLevel === 'medium' ? '중위험' : '저위험'} variant={item.riskLevel} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/analysis/${item.id}`} className="text-primary hover:text-primary-dark font-medium inline-flex items-center gap-1">
                          보기 <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Distribution Chart */}
        <div className="lg:col-span-1">
          <Card title="위험도 분포" className="h-full min-h-[300px]">
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.riskDistribution}>
                  <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                    {metrics.riskDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-text-secondary text-center mt-4 bg-blue-50 p-2 rounded">
              * 최근 {metrics.totalAnalyses}건 기준
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};
