{
    "conditions": [

        [ "1==1", {

            "cflags_cc": [
                "-std=c++14"
            ]

        } ],

        [ "asmjs==1", {
            "ldflags": [
                "--memory-init-file", "0",
                "-s", "TOTAL_MEMORY=134217728"
            ]
        } ]

    ]
}
