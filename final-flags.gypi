{
    "conditions": [

        [ "1==1", {

            "cflags_cc": [
                "-std=c++14",
                "-fvisibility=hidden"
            ],

            "ldflags": [
                "-fvisibility=hidden"
            ],

            "xcode_settings": {
                "OTHER_CPLUSPLUSFLAGS": [
                    "-std=c++14",
                    "-stdlib=libc++"
                ],
                "OTHER_LDFLAGS": [
                    "-stdlib=libc++",
                    "-exported_symbols_list",
                    "/dev/null"
                ],
                "MACOSX_DEPLOYMENT_TARGET": "10.7"
            }

        } ],

        [ "asmjs==1", {
            "ldflags": [
                "--memory-init-file", "0",
                "-s", "TOTAL_MEMORY=134217728"
            ]
        } ]

    ]
}
