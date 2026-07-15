"use client";

import { Search } from "lucide-react";
import React, { useEffect, useState } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { Input } from "../ui/input";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { Language, translate } from "@/lib/i18n";

type Person = { _id: string; username: string; displayName: string; avatar: string; email: string; followStatus: string; followsYou: boolean };

const demoSuggestions = [
  { id: "demo-narendramodi", username: "narendramodi", displayName: "Narendra Modi", avatar: "https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=400" },
  { id: "demo-akshaykumar", username: "akshaykumar", displayName: "Akshay Kumar", avatar: "https://images.pexels.com/photos/1382735/pexels-photo-1382735.jpeg?auto=compress&cs=tinysrgb&w=400" },
  { id: "demo-rashtrapatibhvn", username: "rashtrapatibhvn", displayName: "President of India", avatar: "https://images.pexels.com/photos/1080213/pexels-photo-1080213.jpeg?auto=compress&cs=tinysrgb&w=400" },
];

export default function RightSidebar() {
  const { user } = useAuth();
  const lang: Language = (user?.language as Language) || "en";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [requests, setRequests] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    axiosInstance.get("/follow-requests", { params: { email: user.email } })
      .then((response) => setRequests(response.data || []))
      .catch(console.error);
  }, [user?.email]);

  useEffect(() => {
    if (!user?.email || !query.trim()) { setResults([]); return; }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await axiosInstance.get("/users/search", { params: { email: user.email, q: query } });
        setResults(response.data || []);
      } catch (error) { console.error(error); } finally { setLoading(false); }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, user?.email]);

  const sendRequest = async (person: Person) => {
    if (!user?.email) return;
    await axiosInstance.post("/follow-request", { email: user.email, targetId: person._id });
    setResults((current) => current.map((item) => item._id === person._id ? { ...item, followStatus: "requested" } : item));
  };

  const respondToRequest = async (person: Person, action: "accept" | "reject") => {
    if (!user?.email) return;
    await axiosInstance.patch("/follow-request", { email: user.email, requesterId: person._id, action });
    setRequests((current) => current.filter((item) => item._id !== person._id));
    setResults((current) => current.map((item) => item._id === person._id ? { ...item, followStatus: action === "accept" ? "none" : "none", followsYou: action === "accept" } : item));
  };

  const actionLabel = (person: Person) => person.followStatus === "following" ? "Following" : person.followStatus === "requested" ? "Requested" : person.followsYou ? "Follow back" : translate(lang, "follow");

  return (
    <div className="w-full space-y-4 p-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search username or email" className="pl-12 bg-gray-900 border-gray-800 text-white placeholder-gray-400 rounded-full py-3" />
      </div>

      {query.trim() && <Card className="bg-gray-900 border-gray-800"><CardContent className="p-4 space-y-3">
        <h3 className="text-white font-bold">Search results</h3>
        {loading ? <p className="text-sm text-gray-400">Searching...</p> : results.length === 0 ? <p className="text-sm text-gray-400">No people found.</p> : results.map((person) => (
          <div key={person._id} className="flex items-center gap-2">
            <Avatar className="h-9 w-9"><AvatarImage src={person.avatar} /><AvatarFallback>{person.displayName[0]}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{person.displayName}</p><p className="truncate text-xs text-gray-400">@{person.username} · {person.email}</p></div>
            <Button size="sm" disabled={person.followStatus === "following" || person.followStatus === "requested"} onClick={() => sendRequest(person)} className="rounded-full bg-white text-black hover:bg-gray-200">{actionLabel(person)}</Button>
          </div>
        ))}
      </CardContent></Card>}

      {requests.length > 0 && <Card className="bg-gray-900 border-gray-800"><CardContent className="p-4 space-y-3">
        <h3 className="text-white font-bold">Follow requests</h3>
        {requests.map((person) => <div key={person._id} className="flex items-center gap-2">
          <Avatar className="h-9 w-9"><AvatarImage src={person.avatar} /><AvatarFallback>{person.displayName[0]}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{person.displayName}</p><p className="truncate text-xs text-gray-400">@{person.username}</p></div>
          <Button size="sm" onClick={() => respondToRequest(person, "accept")} className="rounded-full bg-white text-black hover:bg-gray-200">Accept</Button>
          <Button size="sm" variant="outline" onClick={() => respondToRequest(person, "reject")} className="rounded-full">Reject</Button>
        </div>)}
      </CardContent></Card>}

      <Card className="bg-gray-900 border-gray-800"><CardContent className="p-4"><h3 className="text-white text-xl font-bold mb-2">{translate(lang, "subscribePremium")}</h3><p className="text-gray-400 text-sm mb-4">{translate(lang, "premiumDescription")}</p><Button className="bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-full">{translate(lang, "subscribe")}</Button></CardContent></Card>

      <Card className="bg-gray-900 border-gray-800"><CardContent className="p-4">
        <h3 className="text-white text-xl font-bold mb-4">{translate(lang, "youMightLike")}</h3>
        <div className="space-y-4">
          {demoSuggestions.map((suggestion) => (
            <div key={suggestion.id} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-10 w-10"><AvatarImage src={suggestion.avatar} alt={suggestion.displayName} /><AvatarFallback>{suggestion.displayName[0]}</AvatarFallback></Avatar>
                <div className="min-w-0"><p className="truncate font-semibold text-white">{suggestion.displayName}</p><p className="truncate text-sm text-gray-400">@{suggestion.username}</p></div>
              </div>
              <Button variant="outline" onClick={() => setQuery(suggestion.username)} className="rounded-full bg-white px-4 font-semibold text-black hover:bg-gray-200">{translate(lang, "follow")}</Button>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-500">Search a recommended username to send a real follow request.</p>
      </CardContent></Card>
    </div>
  );
}
