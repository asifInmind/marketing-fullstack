'use client';

import React, { useState, useEffect } from 'react'
import HomePage from './(pages)/homePage/page'

const page = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" />;
  }

  return (
    <div>
      <HomePage/>
    </div>
  )
}

export default page
