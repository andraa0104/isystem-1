<?php

return [
    'connection' => env('TENANT_DB_CONNECTION', 'mysql'),
    'databases' => [
        'dbsja',
        'dbbbbs',
        'dbstg',
        'dbarm',
        'dbati',
        'dbjms',
    ],
    'labels' => [
        'dbsja' => 'DB SJA',
        'dbbbbs' => 'DB B3S',
        'dbstg' => 'DB STG',
        'dbarm' => 'DB ARM',
        'dbati' => 'DB ATI',
        'dbjms' => 'DB JMS',
    ],
    'company_codes' => [
        'dbjms' => 'JMS',
    ],
    'companies' => [
        'dbsja' => [
            'name' => 'CV. SEMESTA JAYA ABADI',
            'address' => 'Jalan Sentosa No 31B RT. 35 Kel. Sungai Pinang Dalam Kec. Sungai Pinang ',
            'kota' => 'Kota Samarinda Provinsi Kalimantan Timur',
            'phone' => '0541-771571',
            'email' => 'cs_sja@yahoo.com',
        ],
        'dbstg' => [
            'name' => 'CV. SURYA TEKNIK GEMILANG',
            'address' => 'Jl. Harmoni II (Lingkar Dalam Selatan) RT. 026/002, Pekapuran Raya, Banjarmasin Timur',
            'kota' => 'Kota Banjarmasin Provinsi Kalimantan Selatan',
            'phone' => '0511 - 6783217',
            'email' => '',
        ],
        'dbjms' => [
            'name' => 'CV. JLX MAKMUR SENTOSA',
            'kota' => 'Samarinda',
        ],
    ],
    'last_online_column' => 'LastOnline',
];
