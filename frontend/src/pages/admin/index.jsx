import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '../../context/AuthContext';
import { FiPlus, FiList, FiUsers, FiSettings } from 'react-icons/fi';

export default function AdminDashboard() {
  const { currentUser, loading, isAdmin } = useAuth();
  const router = useRouter();
  const [loadingPage, setLoadingPage] = useState(true);

  // Check if user is admin
  useEffect(() => {
    if (!loading) {
      if (!currentUser) {
        router.push('/login');
      } else if (!isAdmin) {
        router.push('/');
      } else {
        setLoadingPage(false);
      }
    }
  }, [currentUser, loading, isAdmin, router]);

  if (loading || loadingPage) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="relative w-24 h-24">
          <div className="absolute top-0 left-0 w-full h-full border-4 border-t-primary-600 border-b-primary-300 border-l-primary-600 border-r-primary-300 rounded-full animate-spin"></div>
          <div className="absolute top-2 left-2 w-20 h-20 border-4 border-t-primary-400 border-b-primary-100 border-l-primary-400 border-r-primary-100 rounded-full animate-spin-slow"></div>
        </div>
      </div>
    );
  }

  const adminFeatures = [
    {
      title: 'Add New Place',
      description: 'Create a new destination with details and images',
      icon: <FiPlus className="h-8 w-8" />,
      href: '/admin/addPlace',
      color: 'bg-green-100 text-green-600'
    },
    {
      title: 'Manage Places',
      description: 'Edit or delete existing destination listings',
      icon: <FiList className="h-8 w-8" />,
      href: '/admin/managePlaces',
      color: 'bg-blue-100 text-blue-600'
    },
    {
      title: 'User Management',
      description: 'Manage user accounts and permissions',
      icon: <FiUsers className="h-8 w-8" />,
      href: '/admin/users',
      color: 'bg-purple-100 text-purple-600'
    },
    {
      title: 'Settings',
      description: 'Configure application settings',
      icon: <FiSettings className="h-8 w-8" />,
      href: '/admin/settings',
      color: 'bg-gray-100 text-gray-600'
    }
  ];

  return (
    <>
      <Head>
        <title>Admin Dashboard | EasyTrip</title>
        <meta name="description" content="EasyTrip Admin Dashboard" />
      </Head>

      <div className="min-h-screen bg-gray-50 pt-20 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Admin Dashboard
            </h1>
            <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
              Manage destinations and users
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {adminFeatures.map((feature, index) => (
              <Link key={index} href={feature.href}>
                <div className="relative group bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 h-full flex flex-col justify-between cursor-pointer">
                  <div>
                    <div className={`inline-flex p-3 rounded-md ${feature.color} mb-4`}>
                      {feature.icon}
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{feature.title}</h3>
                    <p className="text-sm text-gray-500">{feature.description}</p>
                  </div>
                  <div className="mt-4 text-sm font-medium text-primary-600 group-hover:text-primary-800">
                    Access &rarr;
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-12 bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Admin Information
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-gray-500">
                Your admin account details
              </p>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Full name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{currentUser?.name || 'Not available'}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Email address</dt>
                  <dd className="mt-1 text-sm text-gray-900">{currentUser?.email}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Admin status</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Active
                    </span>
                  </dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Last login</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date().toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}