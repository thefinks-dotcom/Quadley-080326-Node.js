import React, { useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext, API } from '../../App';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { Sparkles, Send } from 'lucide-react';
import ModuleHeader from '../ModuleHeader';

const AIModule = () => {
  const { user } = useContext(AuthContext);
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const getAISuggestion = async () => {
    if (!query.trim()) {
      toast.error('Please enter a question');
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/ai/suggestions`, { query });
      setResponse(res.data.suggestion);
    } catch (error) {
      toast.error('AI is currently unavailable');
      setResponse('AI suggestions feature is coming soon!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ModuleHeader
        title="AI Assistant"
        showBack={true}
        showSearch={false}
      />
      <div className="px-4 pt-4 pb-4 space-y-4">

      <h1 className="text-4xl font-bold gradient-text">✨ AI Assistance</h1>

      <Card className="p-6 bg-gradient-to-r from-muted to-muted">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Ask Quadley AI</h2>
            <p className="text-muted-foreground">Get personalized suggestions and answers</p>
          </div>
        </div>

        <div className="space-y-4">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask anything... What events should I attend? How can I improve my study habits?"
            className="w-full p-4 border rounded-lg min-h-[120px] focus:ring-2 focus:ring-primary"
          />
          <Button
            onClick={getAISuggestion}
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-secondary"
          >
            {loading ? (
              <>Loading...</>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Get AI Suggestion
              </>
            )}
          </Button>
        </div>

        {response && (
          <div className="mt-6 p-4 bg-white rounded-lg">
            <h3 className="font-semibold mb-2">AI Response:</h3>
            <p className="text-foreground whitespace-pre-wrap">{response}</p>
          </div>
        )}
      </Card>

      {/* AI Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 hover:shadow-lg transition-shadow">
          <h3 className="font-semibold mb-2">📚 Study Tips</h3>
          <p className="text-sm text-muted-foreground">Get personalized study recommendations</p>
        </Card>
        <Card className="p-4 hover:shadow-lg transition-shadow">
          <h3 className="font-semibold mb-2">🎯 Event Recommendations</h3>
          <p className="text-sm text-muted-foreground">Discover events based on your interests</p>
        </Card>
        <Card className="p-4 hover:shadow-lg transition-shadow">
          <h3 className="font-semibold mb-2">🤝 Connection Suggestions</h3>
          <p className="text-sm text-muted-foreground">Find students with similar interests</p>
        </Card>
      </div>
      </div>
    </div>
  );
};

export default AIModule;
