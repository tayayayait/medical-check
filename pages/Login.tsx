import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input, Card } from '../components/UIComponents';
import { ShieldCheck } from 'lucide-react';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API delay
    setTimeout(() => {
      // Simple mock logic for demo roles
      const role = email.includes('admin') ? 'admin' : 'reviewer';
      login(role);
      navigate('/dashboard');
      setLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">의료 광고 심의 AI</h1>
          <p className="text-text-secondary mt-2">서비스를 이용하려면 로그인하세요</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <Input 
            label="이메일 주소" 
            placeholder="admin@medai.com 또는 reviewer@medai.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            type="email"
          />
          <Input 
            label="비밀번호" 
            type="password" 
            placeholder="••••••••"
            required
          />
          <Button type="submit" className="w-full" isLoading={loading}>
            로그인
          </Button>
        </form>

        <div className="mt-6 text-center text-xs text-text-secondary">
          <p>데모 계정:</p>
          <p>관리자: admin@medai.com | 검토자: user@medai.com</p>
          <p>비밀번호는 아무거나 입력하세요.</p>
        </div>
      </Card>
    </div>
  );
};
